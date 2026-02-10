package com.casino.uniforms.dto

data class AuthRequest(
    val username: String,
    val password: String
)

data class AuthResponse(
    val token: String,
    val username: String,
    val roles: List<String>
)
