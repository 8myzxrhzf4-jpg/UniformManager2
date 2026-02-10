package com.casino.uniforms.controller

import com.casino.uniforms.dto.*
import com.casino.uniforms.service.UniformService
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.*
import javax.validation.Valid

@RestController
@RequestMapping("/api/uniforms")
class UniformController(
    private val uniformService: UniformService
) {
    
    @GetMapping
    fun getAllUniforms(): ResponseEntity<List<UniformDto>> {
        val uniforms = uniformService.getAllUniforms().map { uniformService.toDto(it) }
        return ResponseEntity.ok(uniforms)
    }
    
    @GetMapping("/{barcode}")
    fun getUniformByBarcode(@PathVariable barcode: String): ResponseEntity<UniformDto> {
        val uniform = uniformService.getUniformByBarcode(barcode)
        return ResponseEntity.ok(uniformService.toDto(uniform))
    }
    
    @PostMapping
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun createUniform(@Valid @RequestBody dto: UniformCreateDto): ResponseEntity<UniformDto> {
        val uniform = uniformService.createUniform(dto)
        return ResponseEntity.status(HttpStatus.CREATED).body(uniformService.toDto(uniform))
    }
    
    @PutMapping("/{barcode}")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun updateUniform(
        @PathVariable barcode: String,
        @Valid @RequestBody dto: UniformUpdateDto
    ): ResponseEntity<UniformDto> {
        val uniform = uniformService.updateUniform(barcode, dto)
        return ResponseEntity.ok(uniformService.toDto(uniform))
    }
    
    @DeleteMapping("/{barcode}")
    @PreAuthorize("hasRole('ADMIN')")
    fun deleteUniform(@PathVariable barcode: String): ResponseEntity<Void> {
        uniformService.deleteUniform(barcode)
        return ResponseEntity.noContent().build()
    }
    
    @PutMapping("/{barcode}/status")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun updateStatus(
        @PathVariable barcode: String,
        @Valid @RequestBody dto: StatusUpdateDto
    ): ResponseEntity<UniformDto> {
        val uniform = uniformService.updateStatus(barcode, dto)
        return ResponseEntity.ok(uniformService.toDto(uniform))
    }
    
    @PostMapping("/{barcode}/issue")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun issueUniform(@PathVariable barcode: String): ResponseEntity<UniformDto> {
        val uniform = uniformService.issueUniform(barcode)
        return ResponseEntity.ok(uniformService.toDto(uniform))
    }
    
    @PostMapping("/{barcode}/return")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun returnUniform(@PathVariable barcode: String): ResponseEntity<UniformDto> {
        val uniform = uniformService.returnUniform(barcode)
        return ResponseEntity.ok(uniformService.toDto(uniform))
    }
    
    @PostMapping("/{barcode}/laundry")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun sendToLaundry(@PathVariable barcode: String): ResponseEntity<UniformDto> {
        val uniform = uniformService.sendToLaundry(barcode)
        return ResponseEntity.ok(uniformService.toDto(uniform))
    }
    
    @PostMapping("/{barcode}/pickup")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun pickupFromLaundry(@PathVariable barcode: String): ResponseEntity<UniformDto> {
        val uniform = uniformService.pickupFromLaundry(barcode)
        return ResponseEntity.ok(uniformService.toDto(uniform))
    }
    
    @PostMapping("/bulk/status")
    @PreAuthorize("hasAnyRole('STAFF', 'ADMIN')")
    fun bulkUpdateStatus(@Valid @RequestBody dto: BulkStatusUpdateDto): ResponseEntity<List<UniformDto>> {
        val uniforms = uniformService.bulkUpdateStatus(dto).map { uniformService.toDto(it) }
        return ResponseEntity.ok(uniforms)
    }
}
