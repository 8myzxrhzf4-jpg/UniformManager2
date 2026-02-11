package com.casino.uniforms.dto

data class ApiResponse<T>(
    val data: T,
    val warnings: List<String> = emptyList()
)
