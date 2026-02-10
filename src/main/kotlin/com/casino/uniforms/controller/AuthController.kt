package com.casino.uniforms.controller

import com.casino.uniforms.dto.AuthRequest
import com.casino.uniforms.dto.AuthResponse
import com.casino.uniforms.security.JwtUtil
import org.springframework.http.ResponseEntity
import org.springframework.security.authentication.AuthenticationManager
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/auth")
class AuthController(
    private val authenticationManager: AuthenticationManager,
    private val userDetailsService: UserDetailsService,
    private val jwtUtil: JwtUtil
) {
    
    @PostMapping("/login")
    fun login(@RequestBody authRequest: AuthRequest): ResponseEntity<AuthResponse> {
        authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken(authRequest.username, authRequest.password)
        )
        
        val userDetails = userDetailsService.loadUserByUsername(authRequest.username)
        val token = jwtUtil.generateToken(userDetails)
        
        val roles = userDetails.authorities.map { it.authority.removePrefix("ROLE_") }
        
        return ResponseEntity.ok(AuthResponse(
            token = token,
            username = userDetails.username,
            roles = roles
        ))
    }
}
