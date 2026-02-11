package com.casino.uniforms.service

import com.casino.uniforms.dto.*
import com.casino.uniforms.exception.*
import com.casino.uniforms.model.UniformItem
import com.casino.uniforms.model.UniformStatus
import com.casino.uniforms.repository.UniformItemRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UniformService(
    private val uniformItemRepository: UniformItemRepository,
    private val hamperService: HamperService
) {
    
    @Transactional
    fun createUniform(dto: UniformCreateDto): UniformItem {
        // Check for duplicate barcode
        if (uniformItemRepository.findByBarcode(dto.barcode).isPresent) {
            throw DuplicateBarcodeException("Uniform with barcode '${dto.barcode}' already exists")
        }
        
        // Validate and normalize status (handles "In Hamper" -> "In Laundry" mapping)
        val normalizedStatus = try {
            UniformStatus.fromString(dto.status).displayName
        } catch (e: IllegalArgumentException) {
            throw InvalidStatusException(e.message ?: "Invalid status")
        }
        
        val uniform = UniformItem().apply {
            name = dto.name
            size = dto.size
            barcode = dto.barcode
            status = normalizedStatus
            category = dto.category
            studioLocation = dto.studioLocation
        }
        
        return uniformItemRepository.save(uniform)
    }
    
    @Transactional
    fun updateUniform(barcode: String, dto: UniformUpdateDto): UniformItem {
        val uniform = uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
        
        dto.name?.let { uniform.name = it }
        dto.size?.let { uniform.size = it }
        dto.category?.let { uniform.category = it }
        dto.studioLocation?.let { uniform.studioLocation = it }
        
        // Status changes go through updateStatus for validation
        dto.status?.let { 
            validateAndUpdateStatus(uniform, it)
        }
        
        return uniformItemRepository.save(uniform)
    }
    
    @Transactional
    fun updateStatus(barcode: String, statusDto: StatusUpdateDto): UniformItem {
        val uniform = uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
        
        validateAndUpdateStatus(uniform, statusDto.status)
        return uniformItemRepository.save(uniform)
    }
    
    @Transactional
    fun issueUniform(barcode: String): UniformItem {
        val uniform = uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
        
        validateAndUpdateStatus(uniform, "Issued")
        return uniformItemRepository.save(uniform)
    }
    
    @Transactional
    fun returnUniform(barcode: String): UniformItem {
        val uniform = uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
        
        validateAndUpdateStatus(uniform, "In Stock")
        return uniformItemRepository.save(uniform)
    }
    
    @Transactional
    fun sendToLaundry(barcode: String): UniformItem {
        val uniform = uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
        
        validateAndUpdateStatus(uniform, "In Laundry")
        
        // Increment hamper count if studio is set
        uniform.studio?.let { studio ->
            hamperService.addToHamper(studio.id!!)
        }
        
        return uniformItemRepository.save(uniform)
    }
    
    @Transactional
    fun pickupFromLaundry(barcode: String): UniformItem {
        val uniform = uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
        
        // Decrement hamper count if moving from In Laundry
        if (uniform.status == "In Laundry") {
            uniform.studio?.let { studio ->
                hamperService.removeFromHamper(studio.id!!)
            }
        }
        
        validateAndUpdateStatus(uniform, "In Stock")
        return uniformItemRepository.save(uniform)
    }
    
    @Transactional
    fun bulkUpdateStatus(dto: BulkStatusUpdateDto): List<UniformItem> {
        val results = mutableListOf<UniformItem>()
        val errors = mutableListOf<String>()
        
        for (barcode in dto.barcodes) {
            try {
                val uniform = uniformItemRepository.findByBarcode(barcode)
                    .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
                
                validateAndUpdateStatus(uniform, dto.status)
                results.add(uniformItemRepository.save(uniform))
            } catch (e: Exception) {
                errors.add("$barcode: ${e.message}")
            }
        }
        
        // If there were any errors, throw exception with all error details
        if (errors.isNotEmpty()) {
            throw InvalidStatusTransitionException("Bulk update failed for some items: ${errors.joinToString("; ")}")
        }
        
        return results
    }
    
    fun getUniformByBarcode(barcode: String): UniformItem {
        return uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
    }
    
    fun getAllUniforms(): List<UniformItem> {
        return uniformItemRepository.findAll()
    }
    
    @Transactional
    fun deleteUniform(barcode: String) {
        val uniform = uniformItemRepository.findByBarcode(barcode)
            .orElseThrow { ResourceNotFoundException("Uniform with barcode '$barcode' not found") }
        
        uniformItemRepository.delete(uniform)
    }
    
    private fun validateAndUpdateStatus(uniform: UniformItem, newStatus: String) {
        // Normalize status (handles "In Hamper" -> "In Laundry")
        val normalizedStatus = try {
            UniformStatus.fromString(newStatus)
        } catch (e: IllegalArgumentException) {
            throw InvalidStatusException(e.message ?: "Invalid status")
        }
        
        // Get current status as enum
        val currentStatus = try {
            UniformStatus.fromString(uniform.status)
        } catch (e: IllegalArgumentException) {
            null // Allow transition from invalid states
        }
        
        // Validate transition
        if (!UniformStatus.isValidTransition(currentStatus, normalizedStatus)) {
            throw InvalidStatusTransitionException(
                "Invalid status transition from '${uniform.status}' to '${normalizedStatus.displayName}'. " +
                "Allowed transitions: ${getAllowedTransitions(currentStatus)}"
            )
        }
        
        uniform.status = normalizedStatus.displayName
    }
    
    private fun getAllowedTransitions(from: UniformStatus?): String {
        if (from == null) return "In Stock"
        
        return when (from) {
            UniformStatus.IN_STOCK -> "Issued"
            UniformStatus.ISSUED -> "In Laundry, In Stock (return), Damaged, Lost"
            UniformStatus.IN_LAUNDRY -> "In Stock, Damaged, Lost"
            UniformStatus.DAMAGED, UniformStatus.LOST -> "None (terminal state)"
        }
    }
    
    fun toDto(uniform: UniformItem): UniformDto {
        return UniformDto(
            id = uniform.id,
            name = uniform.name,
            size = uniform.size,
            barcode = uniform.barcode,
            status = uniform.status,
            category = uniform.category,
            studioLocation = uniform.studioLocation
        )
    }
}
