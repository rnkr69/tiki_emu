// Versiones comprobadas el 2026-08-21. Envejecen rápido: ver §4.2 de la
// especificación antes de tocarlas.
// Desde AGP 9 el soporte de Kotlin va incluido en el propio plugin de Android:
// declarar además org.jetbrains.kotlin.android hace fallar la construcción.
plugins {
    id("com.android.application") version "9.3.1" apply false
}
