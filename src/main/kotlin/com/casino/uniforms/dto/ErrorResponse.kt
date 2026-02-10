package com.casino.uniforms.dto

data class ErrorResponse(
    val status: Int,
    val message: String,
    val timestamp: Long = System.currentTimeMillis(),
    val path: String? = null,
    val errors: List<String>? = null
)
