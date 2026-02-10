package com.casino.uniforms.config

import com.casino.uniforms.model.Role
import com.casino.uniforms.model.User
import com.casino.uniforms.repository.RoleRepository
import com.casino.uniforms.repository.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.crypto.password.PasswordEncoder

@Configuration
class DataInitializer {
    private val logger = LoggerFactory.getLogger(DataInitializer::class.java)
    
    @Bean
    fun initData(
        userRepository: UserRepository,
        roleRepository: RoleRepository,
        passwordEncoder: PasswordEncoder
    ) = CommandLineRunner {
        // Create roles if they don't exist
        val adminRole = roleRepository.findByName("ADMIN").orElseGet {
            logger.info("Creating ADMIN role")
            roleRepository.save(Role(name = "ADMIN"))
        }
        
        val staffRole = roleRepository.findByName("STAFF").orElseGet {
            logger.info("Creating STAFF role")
            roleRepository.save(Role(name = "STAFF"))
        }
        
        val auditorRole = roleRepository.findByName("AUDITOR").orElseGet {
            logger.info("Creating AUDITOR role")
            roleRepository.save(Role(name = "AUDITOR"))
        }
        
        // Create default admin user if it doesn't exist
        if (!userRepository.findByUsername("admin").isPresent) {
            logger.info("Creating default admin user")
            val admin = User(
                username = "admin",
                password = passwordEncoder.encode("admin123"),
                enabled = true,
                roles = mutableSetOf(adminRole)
            )
            userRepository.save(admin)
        }
        
        // Create default staff user if it doesn't exist
        if (!userRepository.findByUsername("staff").isPresent) {
            logger.info("Creating default staff user")
            val staff = User(
                username = "staff",
                password = passwordEncoder.encode("staff123"),
                enabled = true,
                roles = mutableSetOf(staffRole)
            )
            userRepository.save(staff)
        }
        
        logger.info("Data initialization complete")
    }
}
