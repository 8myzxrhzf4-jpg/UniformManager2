package com.casino.uniforms.dto

import javax.validation.constraints.NotBlank
import javax.validation.constraints.NotNull

data class UniformCreateDto(
    @field:NotBlank(message = "Name is required")
    val name: String,
    
    val size: String? = null,
    
    @field:NotBlank(message = "Barcode is required")
    val barcode: String,
    
    val status: String = "In Stock",
    
    val category: String = "Other",
    
    val studioLocation: String? = null
)

data class UniformUpdateDto(
    val name: String? = null,
    val size: String? = null,
    val status: String? = null,
    val category: String? = null,
    val studioLocation: String? = null
)

data class StatusUpdateDto(
    @field:NotBlank(message = "Status is required")
    val status: String
)

data class BulkStatusUpdateDto(
    @field:NotNull(message = "Barcodes list is required")
    val barcodes: List<String>,
    
    @field:NotBlank(message = "Status is required")
    val status: String
)
