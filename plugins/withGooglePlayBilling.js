const { withAppBuildGradle, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function withGooglePlayBilling(config) {
  config = withAppBuildGradle(config, cfg => {
    const dependency = 'implementation("com.android.billingclient:billing:9.1.0")';
    if (!cfg.modResults.contents.includes(dependency)) {
      cfg.modResults.contents += `\n// Revora account-based subscriptions\ndependencies { ${dependency} }\n`;
    }
    return cfg;
  });
  config = withMainApplication(config, cfg => {
    const registration = 'add(app.revora.billing.RevoraBillingPackage())';
    if (!cfg.modResults.contents.includes(registration)) {
      const marker = 'PackageList(this).packages.apply {';
      if (!cfg.modResults.contents.includes(marker)) throw new Error('Cannot register RevoraBillingPackage in MainApplication');
      cfg.modResults.contents = cfg.modResults.contents.replace(marker, `${marker}\n          ${registration}`);
    }
    return cfg;
  });
  return withDangerousMod(config, ['android', async cfg => {
    const dest = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java/app/revora/billing');
    fs.mkdirSync(dest, { recursive: true });
    for (const file of ['RevoraBillingModule.kt', 'RevoraBillingPackage.kt']) {
      fs.copyFileSync(path.join(__dirname, 'google-play-billing', file), path.join(dest, file));
    }
    return cfg;
  }]);
};
