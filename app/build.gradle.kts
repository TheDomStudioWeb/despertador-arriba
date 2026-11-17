plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.thedom.arriba"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "com.thedom.arriba"
        minSdk = 26
        targetSdk = 37
        // En GitHub el número de versión sube solo en cada compilación
        val build = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionCode = 100 + build
        versionName = "1.$build"
        // Solo procesadores de teléfonos (achica mucho el APK)
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    // Firma propia: la misma en cada compilación, así las actualizaciones se instalan encima
    signingConfigs {
        create("arriba") {
            storeFile = file("arriba.keystore")
            storePassword = "arribaapp"
            keyAlias = "arriba"
            keyPassword = "arribaapp"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("arriba")
        }
        release {
            signingConfig = signingConfigs.getByName("arriba")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.core.ktx)
    implementation(libs.mlkit.labeling)
    implementation(libs.mlkit.barcode)
    implementation(libs.androidx.webkit)
}
