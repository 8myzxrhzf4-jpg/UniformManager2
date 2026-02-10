package com.casino.uniforms.model;

import javax.persistence.*;

@Entity
@Table(name = "uniform_items")
public class UniformItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String name;
    
    private String size;
    
    @Column(unique = true, nullable = false)
    private String barcode;
    
    @Column(nullable = false)
    private String status = "In Stock";
    
    @Column(nullable = false)
    private String category = "Other";
    
    @ManyToOne
    @JoinColumn(name = "studio_id")
    private Studio studio;
    
    private String studioLocation;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSize() { return size; }
    public void setSize(String size) { this.size = size; }
    public String getBarcode() { return barcode; }
    public void setBarcode(String barcode) { this.barcode = barcode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Studio getStudio() { return studio; }
    public void setStudio(Studio studio) { this.studio = studio; }
    public String getStudioLocation() { return studioLocation; }
    public void setStudioLocation(String studioLocation) { this.studioLocation = studioLocation; }
}