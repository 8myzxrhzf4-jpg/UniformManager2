package com.casino.uniforms.controller

import com.casino.uniforms.dto.ApiResponse
import com.casino.uniforms.service.HamperService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/laundry")
class LaundryController(private val hamperService: HamperService) {

    /**
     * Handle laundry dropoff operation.
     * Increments hamper count and returns warning if at/over capacity.
     */
    @PostMapping("/dropoff")
    fun dropoffLaundry(@RequestParam studioId: Long, @RequestParam itemCount: Int = 1): ResponseEntity<ApiResponse<Map<String, Any>>> {
        val warnings = mutableListOf<String>()
        
        // Increment hamper for each item
        repeat(itemCount) {
            val isAtOrOverCapacity = hamperService.incrementHamper(studioId)
            if (isAtOrOverCapacity && warnings.isEmpty()) {
                warnings.add("Warning: Hamper at studio $studioId is at or over capacity")
            }
        }
        
        val responseData = mapOf(
            "studioId" to studioId,
            "itemCount" to itemCount,
            "status" to "dropped off"
        )
        
        return ResponseEntity.ok(ApiResponse(data = responseData, warnings = warnings))
    }

    /**
     * Handle laundry pickup operation.
     * Decrements hamper count to keep utilization accurate.
     */
    @PostMapping("/pickup")
    fun pickupLaundry(@RequestParam studioId: Long, @RequestParam itemCount: Int = 1): ResponseEntity<ApiResponse<Map<String, Any>>> {
        // Decrement hamper for each item picked up
        repeat(itemCount) {
            hamperService.decrementHamper(studioId)
        }
        
        val responseData = mapOf(
            "studioId" to studioId,
            "itemCount" to itemCount,
            "status" to "picked up"
        )
        
        return ResponseEntity.ok(ApiResponse(data = responseData, warnings = emptyList()))
    }

    /**
     * Reset hamper count for a studio.
     */
    @PostMapping("/reset")
    fun resetHamper(@RequestParam studioId: Long): ResponseEntity<ApiResponse<Map<String, Any>>> {
        hamperService.resetHamper(studioId)
        
        val responseData = mapOf(
            "studioId" to studioId,
            "status" to "reset"
        )
        
        return ResponseEntity.ok(ApiResponse(data = responseData, warnings = emptyList()))
    }
}
