const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Raises the Gradle daemon heap so R8 can finish a clean release build.
 *
 * The template ships `-Xmx2048m`. R8 has to hold the whole merged program in
 * memory at once, and this app's release classpath — Firebase, Play Services,
 * Google Mobile Ads and Play Billing — does not fit. It fails as
 * "Compilation failed to complete", with no mention of memory, and it fails
 * only on a full build: an incremental one has most tasks already up to date,
 * so it slips through and the problem looks intermittent rather than constant.
 *
 * `expo-build-properties` exposes no JVM setting, and `android/` is generated,
 * so this is the only place the value survives a prebuild.
 */
const JVM_ARGS = '-Xmx6144m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError';

module.exports = (config) =>
  withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter(
      (item) => !(item.type === 'property' && item.key === 'org.gradle.jvmargs'),
    );
    cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    return cfg;
  });
