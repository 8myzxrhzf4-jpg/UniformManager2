package com.casino.uniforms.model;

import javax.persistence.*;
import java.util.Date;

@Entity
@Table(name = "assignments")
public class Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gp_name")
    private String gpName;

    @Column(name = "item_name")
    private String itemName;

    @Column(name = "size")
    private String size;

    @Column(name = "date")
    @Temporal(TemporalType.TIMESTAMP)
    private Date date;

    @Column(name = "item_barcode")
    private String itemBarcode;

    @Column(name = "studio")
    private String studio;

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getGpName() {
        return gpName;
    }

    public void setGpName(String gpName) {
        this.gpName = gpName;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getSize() {
        return size;
    }

    public void setSize(String size) {
        this.size = size;
    }

    public Date getDate() {
        return date;
    }

    public void setDate(Date date) {
        this.date = date;
    }

    public String getItemBarcode() {
        return itemBarcode;
    }

    public void setItemBarcode(String itemBarcode) {
        this.itemBarcode = itemBarcode;
    }

    public String getStudio() {
        return studio;
    }

    public void setStudio(String studio) {
        this.studio = studio;
    }
}