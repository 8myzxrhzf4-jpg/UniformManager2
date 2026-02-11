package com.casino.uniforms.service

import com.casino.uniforms.repository.StudioRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class HamperService(private val studioRepository: StudioRepository) {

    /**
     * Increments the hamper count for a studio (soft limit - allows going over capacity).
     * @param studioId The ID of the studio
     * @return true if hamper is at or over capacity (warning), false otherwise
     */
    @Transactional
    fun incrementHamper(studioId: Long): Boolean {
        val studio = studioRepository.findById(studioId)
            .orElseThrow { IllegalArgumentException("Studio not found with id: $studioId") }
        
        studioRepository.incrementHamper(studioId)
        studioRepository.flush()  // Ensure the increment is flushed to the database
        
        // Re-read the studio to get the updated count
        val updatedStudio = studioRepository.findById(studioId).orElseThrow()
        
        // Check if at or over capacity (use Java getters)
        return updatedStudio.getCurrentHamperCount() >= studio.getHamperCapacity()
    }

    /**
     * Decrements the hamper count for a studio.
     * @param studioId The ID of the studio
     */
    @Transactional
    fun decrementHamper(studioId: Long) {
        studioRepository.decrementHamper(studioId)
    }

    /**
     * Resets the hamper count for a studio to 0.
     * @param studioId The ID of the studio
     */
    @Transactional
    fun resetHamper(studioId: Long) {
        studioRepository.resetHamperCount(studioId)
    }
}
