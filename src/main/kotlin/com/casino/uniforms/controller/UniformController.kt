package com.casino.uniforms.controller

import com.casino.uniforms.dto.ApiResponse
import com.casino.uniforms.service.HamperService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/uniform")
class UniformController(private val hamperService: HamperService) {

    /**
     * Handle uniform return operation.
     * Increments hamper count and returns warning if at/over capacity.
     */
    @PostMapping("/return")
    fun returnUniform(@RequestParam studioId: Long, @RequestParam barcode: String): ResponseEntity<ApiResponse<Map<String, Any>>> {
        val isAtOrOverCapacity = hamperService.incrementHamper(studioId)
        
        val warnings = mutableListOf<String>()
        if (isAtOrOverCapacity) {
            warnings.add("Warning: Hamper at studio $studioId is at or over capacity")
        }
        
        val responseData = mapOf(
            "studioId" to studioId,
            "barcode" to barcode,
            "status" to "returned"
        )
        
        return ResponseEntity.ok(ApiResponse(data = responseData, warnings = warnings))
    }
}
