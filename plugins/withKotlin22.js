const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Forces the Kotlin Gradle plugin (and stdlib) to 2.2.20.
 *
 * React Native 0.86 resolves Kotlin 2.1.20, whose compiler cannot read the
 * Kotlin 2.3 metadata inside play-services-ads 25.x — the Google Mobile Ads
 * dependency. Kotlin N reads metadata up to N+1, so 2.2 is the earliest
 * compiler that accepts it. `android.kotlinVersion` alone does not win because
 * the plugin version on the buildscript classpath is substituted by the RN
 * gradle plugin; pinning the classpath entry is what actually decides it.
 */
const VERSION = '2.2.20';

module.exports = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
      `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${VERSION}')`,
    );
    return cfg;
  });
