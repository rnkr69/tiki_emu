import javax.inject.Inject

plugins {
    id("com.android.application")
}

android {
    namespace = "es.tikiemu"
    compileSdk = 37

    defaultConfig {
        applicationId = "es.tikiemu"
        minSdk = 26          // startLocalOnlyHotspot() no existe antes
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")

    // Servidor embebido. CIO es el motor en Kotlin puro, sin Netty: menos peso
    // y suficiente para lo que hacemos.
    implementation("io.ktor:ktor-server-core:3.5.2")
    implementation("io.ktor:ktor-server-cio:3.5.2")
    implementation("io.ktor:ktor-server-websockets:3.5.2")
    // Respuestas por rangos: el emulador pide trozos de las ROMs grandes.
    implementation("io.ktor:ktor-server-partial-content:3.5.2")
}

/**
 * Copia `web/` a los assets tal cual, sin tocar nada.
 *
 * La regla de oro del proyecto es que `web/` no sabe quién le sirve, así que
 * aquí no se transforma: se copia. Al ser una tarea de Gradle, cualquier cambio
 * en la web entra en el APK sin pasos manuales ni ficheros duplicados en el
 * repositorio.
 */
abstract class CopiarWeb : DefaultTask() {
    @get:InputDirectory
    abstract val origen: DirectoryProperty

    @get:OutputDirectory
    abstract val destino: DirectoryProperty

    @get:Inject
    abstract val fs: FileSystemOperations

    @TaskAction
    fun copiar() {
        fs.sync {
            from(origen)
            into(destino.dir("web"))
        }
    }
}

val copiarWeb = tasks.register<CopiarWeb>("copiarWeb") {
    // Ruta canónica: con un `..` sin resolver, Gradle falla al calcular las
    // dependencias de la tarea con un escueto «Invalid file path».
    origen.fileValue(rootProject.projectDir.parentFile.resolve("web").canonicalFile)
}

// AGP 9 no admite añadir directorios generados al sourceSet directamente: hay
// que declararlos por variante, que además encadena bien las dependencias.
androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(copiarWeb, CopiarWeb::destino)
    }
}
