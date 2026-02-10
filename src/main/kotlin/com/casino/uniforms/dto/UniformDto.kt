package com.casino.uniforms.dto

data class UniformDto(
    val id: Long? = null,
    val name: String? = null,
    val size: String? = null,
    val barcode: String? = null,
    val status: String? = "In Stock",
    val category: String? = "Other",
    val studioLocation: String? = ""
)