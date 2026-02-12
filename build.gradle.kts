// Top-level build file
plugins {
    id("com.android.application") version "8.3.0" apply false
    id("com.android.library") version "8.3.0" apply false
    id("com.google.gms.google-services") version "4.4.0" apply false
    // REMOVE THIS LINE:
    // id("org.jetbrains.kotlin.android") version "2.2.10" apply false

    // KEEP THIS: This is the new way to handle Compose for Kotlin 2.0+
    alias(libs.plugins.kotlin.compose) apply false
}