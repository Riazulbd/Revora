package app.revora.billing

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

// ReactPackage's members are deprecated in favour of the new architecture's
// TurboReactPackage; Revora still ships the bridge module, so this is deliberate.
@Suppress("OVERRIDE_DEPRECATION")
class RevoraBillingPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(RevoraBillingModule(reactContext))

    // Billing has no UI of its own; the Plan screen is ordinary React Native.
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
