package com.casino.uniforms.repository

import com.casino.uniforms.model.UniformItem
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.util.*

@Repository
interface UniformItemRepository : JpaRepository<UniformItem, Long> {
    fun findByBarcode(barcode: String): Optional<UniformItem>
    fun findAllByStudio_NameAndStudio_City_Name(studioName: String, cityName: String): List<UniformItem>
    fun findAllByStatusAndStudio_Name(status: String, studioName: String): List<UniformItem>
    fun findAllByStudio_IdAndStatus(studioId: Long, status: String): List<UniformItem>
}