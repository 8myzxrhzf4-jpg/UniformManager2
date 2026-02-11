package com.casino.uniforms.model

enum class UniformStatus(val displayName: String) {
    IN_STOCK("In Stock"),
    ISSUED("Issued"),
    IN_LAUNDRY("In Laundry"),
    DAMAGED("Damaged"),
    LOST("Lost");

    companion object {
        fun fromString(value: String): UniformStatus {
            // Map "In Hamper" to IN_LAUNDRY for Android app compatibility
            if (value.equals("In Hamper", ignoreCase = true)) {
                return IN_LAUNDRY
            }
            
            return values().find { 
                it.displayName.equals(value, ignoreCase = true) || 
                it.name.equals(value, ignoreCase = true)
            } ?: throw IllegalArgumentException("Invalid status: $value. Allowed values: ${getAllowedStatuses()}")
        }
        
        fun getAllowedStatuses(): String {
            return values().joinToString(", ") { it.displayName } + ", In Hamper (alias for In Laundry)"
        }
        
        fun isValidTransition(from: UniformStatus?, to: UniformStatus): Boolean {
            if (from == null) return to == IN_STOCK
            
            return when (from) {
                IN_STOCK -> to in setOf(ISSUED)
                ISSUED -> to in setOf(IN_LAUNDRY, IN_STOCK, DAMAGED, LOST)
                IN_LAUNDRY -> to in setOf(IN_STOCK, DAMAGED, LOST)
                DAMAGED, LOST -> false // Terminal states unless admin restore
            }
        }
    }
}
