package com.casino.uniforms.model;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "studio")
public class Studio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "hamper_capacity")
    private int hamperCapacity;

    @Column(name = "current_hamper_count")
    private int currentHamperCount;

    @ManyToOne
    @JoinColumn(name = "city_id")
    private City city;

    @OneToMany(mappedBy = "studio")
    private List<UniformItem> uniformItems;

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getHamperCapacity() {
        return hamperCapacity;
    }

    public void setHamperCapacity(int hamperCapacity) {
        this.hamperCapacity = hamperCapacity;
    }

    public int getCurrentHamperCount() {
        return currentHamperCount;
    }

    public void setCurrentHamperCount(int currentHamperCount) {
        this.currentHamperCount = currentHamperCount;
    }

    public City getCity() {
        return city;
    }

    public void setCity(City city) {
        this.city = city;
    }

    public List<UniformItem> getUniformItems() {
        return uniformItems;
    }

    public void setUniformItems(List<UniformItem> uniformItems) {
        this.uniformItems = uniformItems;
    }
}