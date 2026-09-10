package app.revora.billing

import android.os.Handler
import android.os.Looper
import com.android.billingclient.api.*
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

/** Only transports Play data. Granting and acknowledgement belong to the backend. */
class RevoraBillingModule(private val context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context), PurchasesUpdatedListener {
    private val main = Handler(Looper.getMainLooper())
    private val productId = "revora_pro"
    private var connecting = false
    private val connectionWaiters = mutableListOf<(BillingResult) -> Unit>()
    private val client = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().enablePrepaidPlans().build())
        .enableAutoServiceReconnection()
        .build()

    override fun getName() = "RevoraBilling"

    private fun connected(promise: Promise, action: () -> Unit) {
        main.post {
            if (client.isReady) { action(); return@post }
            connectionWaiters.add { result ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) action()
                else promise.reject("BILLING_${result.responseCode}", "Google Play Billing is unavailable. Try again.")
            }
            if (connecting) return@post
            connecting = true
            val timeout = Runnable {
                finishConnection(BillingResult.newBuilder().setResponseCode(BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE).build())
            }
            main.postDelayed(timeout, 20000)
            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    main.post { main.removeCallbacks(timeout); finishConnection(result) }
                }
                override fun onBillingServiceDisconnected() { /* Automatic reconnection on next request. */ }
            })
        }
    }

    private fun finishConnection(result: BillingResult) {
        connecting = false
        val callbacks = connectionWaiters.toList()
        connectionWaiters.clear()
        callbacks.forEach { it(result) }
    }

    private fun queryProduct(callback: (BillingResult, ProductDetails?) -> Unit) {
        val params = QueryProductDetailsParams.newBuilder().setProductList(listOf(
            QueryProductDetailsParams.Product.newBuilder().setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS).build()
        )).build()
        client.queryProductDetailsAsync(params) { result, details ->
            callback(result, details.productDetailsList.firstOrNull { it.productId == productId })
        }
    }

    @ReactMethod
    fun getSubscription(promise: Promise) = connected(promise) {
        queryProduct { result, product ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                promise.reject("BILLING_${result.responseCode}", "Could not load subscription information from Google Play.")
            } else if (product == null) {
                promise.reject("PRODUCT_UNAVAILABLE", "Revora Pro is not available for this Google Play account. Try again later.")
            } else {
                val offers = Arguments.createArray()
                // Present ordinary base plans only. Promotional/instalment offers need
                // extra eligibility/commitment UI and are deliberately not sold here.
                product.subscriptionOfferDetails.orEmpty().filter {
                    it.offerId == null && it.installmentPlanDetails == null
                }.forEach { offer ->
                    val phases = Arguments.createArray()
                    offer.pricingPhases.pricingPhaseList.forEach { phase ->
                        phases.pushMap(Arguments.createMap().apply {
                            putString("formattedPrice", phase.formattedPrice)
                            putString("billingPeriod", phase.billingPeriod)
                            putInt("billingCycleCount", phase.billingCycleCount)
                            putInt("recurrenceMode", phase.recurrenceMode)
                        })
                    }
                    offers.pushMap(Arguments.createMap().apply {
                        putString("basePlanId", offer.basePlanId)
                        putString("offerToken", offer.offerToken)
                        putArray("phases", phases)
                    })
                }
                promise.resolve(Arguments.createMap().apply {
                    putString("productId", product.productId)
                    putString("title", product.name)
                    putString("description", product.description)
                    putArray("offers", offers)
                })
            }
        }
    }

    @ReactMethod
    fun launchPurchase(offerToken: String, obfuscatedAccountId: String, promise: Promise) = connected(promise) {
        if (!obfuscatedAccountId.matches(Regex("[a-f0-9]{64}"))) {
            promise.reject("ACCOUNT_REQUIRED", "Sign in to Revora before subscribing.")
            return@connected
        }
        // Fetch fresh ProductDetails for every launch; never persist/cache it.
        queryProduct { result, product ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK || product == null) {
                promise.reject("PRODUCT_UNAVAILABLE", "Reload the subscription and try again.")
                return@queryProduct
            }
            val offer = product.subscriptionOfferDetails.orEmpty().find {
                it.offerToken == offerToken && it.offerId == null && it.installmentPlanDetails == null
            }
            if (offer == null) {
                promise.reject("OFFER_CHANGED", "This plan changed. Reload the subscription and try again.")
                return@queryProduct
            }
            main.post {
                val activity = context.currentActivity
                if (activity == null) { promise.reject("NO_ACTIVITY", "Open Revora and try again."); return@post }
                val details = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(product).setOfferToken(offer.offerToken).build()
                val params = BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(details))
                    .setObfuscatedAccountId(obfuscatedAccountId).build()
                val launched = client.launchBillingFlow(activity, params)
                promise.resolve(launched.responseCode)
            }
        }
    }

    @ReactMethod
    fun queryPurchases(promise: Promise) = connected(promise) {
        val params = QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        client.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) promise.resolve(purchaseArray(purchases))
            else promise.reject("BILLING_${result.responseCode}", "Could not restore purchases from Google Play.")
        }
    }

    private fun purchaseArray(purchases: List<Purchase>): WritableArray = Arguments.createArray().apply {
        purchases.filter { it.products.contains(productId) }.forEach { purchase ->
            pushMap(Arguments.createMap().apply {
                putString("productId", productId)
                putString("purchaseToken", purchase.purchaseToken)
                putString("state", when (purchase.purchaseState) {
                    Purchase.PurchaseState.PURCHASED -> "PURCHASED"
                    Purchase.PurchaseState.PENDING -> "PENDING"
                    else -> "UNSPECIFIED"
                })
            })
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        if (!context.hasActiveReactInstance()) return
        context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("RevoraBillingPurchases", Arguments.createMap().apply {
                putInt("responseCode", result.responseCode)
                putArray("purchases", purchaseArray(purchases.orEmpty()))
            })
    }

    @ReactMethod fun addListener(eventName: String) { /* Required by NativeEventEmitter. */ }
    @ReactMethod fun removeListeners(count: Double) { /* Required by NativeEventEmitter. */ }

    override fun invalidate() {
        main.post { main.removeCallbacksAndMessages(null); client.endConnection(); connectionWaiters.clear() }
        super.invalidate()
    }
}
