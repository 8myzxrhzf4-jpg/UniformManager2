package com.casino.uniforms.model

import javax.persistence.*

@Entity
@Table(name = "users")
data class User(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    
    @Column(unique = true, nullable = false)
    var username: String = "",
    
    @Column(nullable = false)
    var password: String = "",
    
    @Column(nullable = false)
    var enabled: Boolean = true,
    
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = [JoinColumn(name = "user_id")],
        inverseJoinColumns = [JoinColumn(name = "role_id")]
    )
    var roles: MutableSet<Role> = mutableSetOf()
) {
    constructor() : this(null, "", "", true, mutableSetOf())
}
