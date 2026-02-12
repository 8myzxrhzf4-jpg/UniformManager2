package com.casino.uniforms

import android.content.Context
import android.content.ContextWrapper
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.google.firebase.database.*
import com.google.firebase.database.ktx.database
import com.google.firebase.ktx.Firebase
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.io.*
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.Executors

// --- DATA MODELS ---

data class Studio(
    val name: String,
    var hamperCapacity: Int = 50,
    var currentHamperCount: Int = 0
)

data class City(val name: String, val studios: List<Studio>)

data class UniformItem(
    val name: String?,
    val size: String?,
    val barcode: String?,
    var status: String? = "In Stock",
    val category: String = "Other",
    var studioLocation: String = ""
)

data class LaundryOrder(
    val id: String,
    val items: List<String>,
    val originStudio: String,
    val timestamp: String
)

data class GamePresenter(val name: String, val barcode: String)

data class Assignment(
    val id: String = UUID.randomUUID().toString(),
    val gpName: String,
    val itemName: String,
    val size: String,
    val date: String,
    val itemBarcode: String,
    val studio: String,
    var pushKey: String? = null  // Firebase push key for reliable deletion
)

data class AuditEntry(val date: String, val action: String, val details: String)

data class AuditDiff(val name: String, val barcode: String, val expectedStatus: String, val countedStatus: String)

// --- BRANDING COLORS ---
val NavyBG = Color(0xFF050A18)
val Gold = Color(0xFFFFD700)
val ComplementaryOrange = Color(0xFFFFA000)
val SurfaceBlue = Color(0xFF161E2E)
val AlertRed = Color(0xFFFF4444)
val AuditGreen = Color(0xFF2E7D32)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme(primary = Gold, background = NavyBG, surface = SurfaceBlue)) {
                UniformApp()
            }
        }
    }
}

// --- CORE UTILS ---

// Normalize status to canonical values
fun normalizeStatus(status: String?): String {
    return when (status?.trim()) {
        "In Hamper", "Laundry" -> "In Laundry"
        "Issued" -> "Issued"
        "Damaged", "Lost" -> status // Terminal states
        else -> "In Stock"
    }
}

fun determineCategory(name: String): String {
    val n = name.uppercase()
    return when {
        n.contains("JACKET") || n.contains("BLAZER") -> "Jacket"
        n.contains("VEST") || n.contains("WAISTCOAT") -> "Vest"
        n.contains("SHIRT") || n.contains("TOP") -> "Shirt"
        n.contains("TROUSER") || n.contains("PANT") -> "Trousers"
        else -> "Other"
    }
}

// --- DATA LOADING HELPERS ---

fun loadCityData(p: android.content.SharedPreferences): SnapshotStateList<City> {
    val json = p.getString("city_map", null)
    val list = mutableStateListOf<City>()
    if (json != null) {
        list.addAll(Gson().fromJson(json, object : TypeToken<List<City>>() {}.type))
    } else {
        list.add(City("Atlantic City", listOf(Studio("Ocean", 50), Studio("Hard Rock", 50))))
    }
    return list
}

fun <T> loadScopedData(prefs: android.content.SharedPreferences, key: String, scope: String): SnapshotStateList<T> {
    val finalKey = "${scope}_$key"
    val json = prefs.getString(finalKey, null)
    val list = mutableStateListOf<T>()
    if (json != null) {
        val type = when (key) {
            "inv" -> object : TypeToken<List<UniformItem>>() {}.type
            "assign" -> object : TypeToken<List<Assignment>>() {}.type
            "laundry_orders" -> object : TypeToken<List<LaundryOrder>>() {}.type
            "logs" -> object : TypeToken<List<AuditEntry>>() {}.type
            else -> object : TypeToken<List<String>>() {}.type
        }
        val data: List<T> = Gson().fromJson(json, type)
        list.addAll(data)
    }
    return list
}

fun loadGPs(p: android.content.SharedPreferences): SnapshotStateList<GamePresenter> {
    val json = p.getString("gps", null)
    val list = mutableStateListOf<GamePresenter>()
    if (json != null) {
        list.addAll(Gson().fromJson(json, object : TypeToken<List<GamePresenter>>() {}.type))
    }
    return list
}

// --- MAIN APP COMPOSABLE ---

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UniformApp() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("UniformPrefs", Context.MODE_PRIVATE) }

    // --- GLOBAL STATE ---
    val cityList = remember { loadCityData(prefs) }
    val gpList = remember { loadGPs(prefs) }

    // --- SELECTION STATE ---
    val defaultCity = cityList.firstOrNull()?.name ?: "Default City"
    var selectedCityName by remember { mutableStateOf(prefs.getString("selected_city", defaultCity) ?: defaultCity) }

    val currentCityObj = cityList.find { it.name == selectedCityName }
    val defaultStudio = currentCityObj?.studios?.firstOrNull()?.name ?: "Main Studio"

    var selectedStudioName by remember(selectedCityName) {
        mutableStateOf(prefs.getString("selected_studio", defaultStudio) ?: defaultStudio)
    }

    // --- CITY-ISOLATED DATA STATE (Reloads when City changes) ---
    val inventory = remember(selectedCityName) { loadScopedData<UniformItem>(prefs, "inv", selectedCityName) }
    val assignments = remember(selectedCityName) { loadScopedData<Assignment>(prefs, "assign", selectedCityName) }
    val laundryOrders = remember(selectedCityName) { loadScopedData<LaundryOrder>(prefs, "laundry_orders", selectedCityName) }
    val auditLogs = remember(selectedCityName) { loadScopedData<AuditEntry>(prefs, "logs", selectedCityName) }

    // Default laundry return studio based on CURRENT city
    var laundryReturnStudio by remember(selectedCityName) {
        val saved = prefs.getString("${selectedCityName}_return_studio", null)
        mutableStateOf(saved ?: defaultStudio)
    }

    // --- UI STATE ---
    var activeScreen by remember { mutableStateOf("home") }
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("All") }

    // Dialogs
    var showLocationAdmin by remember { mutableStateOf(false) }
    var isAdminAuthenticated by remember { mutableStateOf(false) }
    var showAddGPDialog by remember { mutableStateOf(false) }
    var showTransferDialog by remember { mutableStateOf(false) }
    var showClearDialog by remember { mutableStateOf(false) }
    var showChangePassDialog by remember { mutableStateOf(false) }
    var showLocationSwitchAuth by remember { mutableStateOf(false) }
    var pendingCitySwitch by remember { mutableStateOf<String?>(null) }
    var menuExpanded by remember { mutableStateOf(false) }
    var pendingDiffs by remember { mutableStateOf<List<AuditDiff>>(emptyList()) }

    // --- FIREBASE INTEGRATION ---
    val database = remember { Firebase.database.reference }
    
    // Firebase listener for cities (global)
    DisposableEffect(Unit) {
        val citiesListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val cities = mutableListOf<City>()
                snapshot.children.forEach { citySnap ->
                    val cityName = citySnap.key ?: return@forEach
                    val studiosList = mutableListOf<Studio>()
                    citySnap.child("studios").children.forEach { studioSnap ->
                        val studioName = studioSnap.key ?: return@forEach
                        val capacity = studioSnap.child("hamperCapacity").getValue(Int::class.java) ?: 50
                        val count = studioSnap.child("currentHamperCount").getValue(Int::class.java) ?: 0
                        studiosList.add(Studio(studioName, capacity, count))
                    }
                    cities.add(City(cityName, studiosList))
                }
                if (cities.isNotEmpty()) {
                    cityList.clear()
                    cityList.addAll(cities)
                }
            }
            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(context, "Firebase Error: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
        database.child("cities").addValueEventListener(citiesListener)
        onDispose {
            database.child("cities").removeEventListener(citiesListener)
        }
    }

    // Firebase listener for game presenters (global)
    DisposableEffect(Unit) {
        val gpsListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val gps = mutableListOf<GamePresenter>()
                snapshot.children.forEach { gpSnap ->
                    val name = gpSnap.child("name").getValue(String::class.java) ?: return@forEach
                    val barcode = gpSnap.child("barcode").getValue(String::class.java) ?: return@forEach
                    gps.add(GamePresenter(name, barcode))
                }
                if (gps.isNotEmpty()) {
                    gpList.clear()
                    gpList.addAll(gps)
                }
            }
            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(context, "Firebase Error: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
        database.child("game_presenters").addValueEventListener(gpsListener)
        onDispose {
            database.child("game_presenters").removeEventListener(gpsListener)
        }
    }

    // Firebase listeners for city-scoped data (rebind when city changes)
    DisposableEffect(selectedCityName) {
        val cityPath = "cities/$selectedCityName"
        
        // Inventory listener
        val invListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val items = mutableListOf<UniformItem>()
                snapshot.children.forEach { itemSnap ->
                    val name = itemSnap.child("name").getValue(String::class.java)
                    val size = itemSnap.child("size").getValue(String::class.java)
                    val barcode = itemSnap.child("barcode").getValue(String::class.java)
                    val status = itemSnap.child("status").getValue(String::class.java)
                    val category = itemSnap.child("category").getValue(String::class.java) ?: "Other"
                    val studioLocation = itemSnap.child("studioLocation").getValue(String::class.java) ?: ""
                    items.add(UniformItem(name, size, barcode, normalizeStatus(status), category, studioLocation))
                }
                inventory.clear()
                inventory.addAll(items)
            }
            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(context, "Inventory Error: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
        
        // Assignments listener
        val assignListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val assigns = mutableListOf<Assignment>()
                snapshot.children.forEach { assignSnap ->
                    val id = assignSnap.child("id").getValue(String::class.java) ?: UUID.randomUUID().toString()
                    val gpName = assignSnap.child("gpName").getValue(String::class.java) ?: return@forEach
                    val itemName = assignSnap.child("itemName").getValue(String::class.java) ?: ""
                    val size = assignSnap.child("size").getValue(String::class.java) ?: ""
                    val date = assignSnap.child("date").getValue(String::class.java) ?: ""
                    val itemBarcode = assignSnap.child("itemBarcode").getValue(String::class.java) ?: ""
                    val studio = assignSnap.child("studio").getValue(String::class.java) ?: ""
                    val pushKey = assignSnap.key // Store Firebase push key
                    assigns.add(Assignment(id, gpName, itemName, size, date, itemBarcode, studio, pushKey))
                }
                assignments.clear()
                assignments.addAll(assigns)
            }
            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(context, "Assignments Error: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
        
        // Laundry orders listener
        val laundryListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val orders = mutableListOf<LaundryOrder>()
                snapshot.children.forEach { orderSnap ->
                    val id = orderSnap.child("id").getValue(String::class.java) ?: return@forEach
                    val items = orderSnap.child("items").children.mapNotNull { it.getValue(String::class.java) }
                    val originStudio = orderSnap.child("originStudio").getValue(String::class.java) ?: ""
                    val timestamp = orderSnap.child("timestamp").getValue(String::class.java) ?: ""
                    orders.add(LaundryOrder(id, items, originStudio, timestamp))
                }
                laundryOrders.clear()
                laundryOrders.addAll(orders)
            }
            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(context, "Laundry Error: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
        
        // Logs listener
        val logsListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                val logs = mutableListOf<AuditEntry>()
                snapshot.children.forEach { logSnap ->
                    val date = logSnap.child("date").getValue(String::class.java) ?: return@forEach
                    val action = logSnap.child("action").getValue(String::class.java) ?: ""
                    val details = logSnap.child("details").getValue(String::class.java) ?: ""
                    logs.add(AuditEntry(date, action, details))
                }
                auditLogs.clear()
                auditLogs.addAll(logs)
            }
            override fun onCancelled(error: DatabaseError) {
                Toast.makeText(context, "Logs Error: ${error.message}", Toast.LENGTH_SHORT).show()
            }
        }
        
        database.child("$cityPath/inventory").addValueEventListener(invListener)
        database.child("$cityPath/assignments").addValueEventListener(assignListener)
        database.child("$cityPath/laundry_orders").addValueEventListener(laundryListener)
        database.child("$cityPath/logs").addValueEventListener(logsListener)
        
        onDispose {
            database.child("$cityPath/inventory").removeEventListener(invListener)
            database.child("$cityPath/assignments").removeEventListener(assignListener)
            database.child("$cityPath/laundry_orders").removeEventListener(laundryListener)
            database.child("$cityPath/logs").removeEventListener(logsListener)
        }
    }

    // --- LOGIC FUNCTIONS ---

    fun saveData() {
        val gson = Gson()
        val database = Firebase.database.reference
        
        // Save to SharedPreferences for offline access (local cache)
        prefs.edit().apply {
            putString("city_map", gson.toJson(cityList.toList()))
            putString("gps", gson.toJson(gpList.toList()))
            putString("selected_city", selectedCityName)
            putString("selected_studio", selectedStudioName)
            putString("${selectedCityName}_inv", gson.toJson(inventory.toList()))
            putString("${selectedCityName}_assign", gson.toJson(assignments.toList()))
            putString("${selectedCityName}_laundry_orders", gson.toJson(laundryOrders.toList()))
            putString("${selectedCityName}_logs", gson.toJson(auditLogs.toList()))
            putString("${selectedCityName}_return_studio", laundryReturnStudio)
            apply()
        }
        
        // Sync to Firebase
        // Cities
        cityList.forEach { city ->
            city.studios.forEach { studio ->
                database.child("cities/${city.name}/studios/${studio.name}").setValue(
                    mapOf("hamperCapacity" to studio.hamperCapacity, "currentHamperCount" to studio.currentHamperCount)
                )
            }
        }
        
        // Game Presenters (global)
        database.child("game_presenters").setValue(gpList.map { mapOf("name" to it.name, "barcode" to it.barcode) })
        
        // City-scoped data
        val cityPath = "cities/$selectedCityName"
        database.child("$cityPath/inventory").setValue(inventory.map { 
            mapOf("name" to it.name, "size" to it.size, "barcode" to it.barcode, 
                  "status" to it.status, "category" to it.category, "studioLocation" to it.studioLocation) 
        })
        database.child("$cityPath/laundry_orders").setValue(laundryOrders.map { 
            mapOf("id" to it.id, "items" to it.items, "originStudio" to it.originStudio, "timestamp" to it.timestamp) 
        })
        database.child("$cityPath/logs").setValue(auditLogs.map { 
            mapOf("date" to it.date, "action" to it.action, "details" to it.details) 
        })
    }

    fun addLog(action: String, details: String) {
        val date = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault()).format(Date())
        auditLogs.add(0, AuditEntry(date, action, details))
        saveData()
    }

    fun getFileName(type: String): String = "${selectedCityName}_${selectedStudioName}_${type}.csv"

    // --- CSV LAUNCHERS ---
    val auditReportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        uri?.let { exportAuditReportCsv(context, it, pendingDiffs, selectedCityName, selectedStudioName) }
    }
    val invImp = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let { importInventoryCsv(context, it, inventory, selectedCityName, selectedStudioName) { saveData() } } }
    val gpImp = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { it?.let { importGPCsv(context, it, gpList) { saveData() } } }
    val invExp = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { it?.let { exportInventoryCsv(context, it, inventory, selectedCityName, selectedStudioName) } }
    val issuedExp = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { it?.let { exportIssuedCsv(context, it, assignments, selectedCityName, selectedStudioName) } }
    val logExp = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { it?.let { exportMasterLogCsv(context, it, auditLogs, selectedCityName, selectedStudioName) } }

    // --- UI STRUCTURE ---
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("UNIFORM PRO", fontWeight = FontWeight.Black, color = Gold, fontSize = 16.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (activeScreen == "home") {
                                // City Dropdown (Admin Gated)
                                CityDropdown(cityList, selectedCityName) { targetCity ->
                                    if(targetCity != selectedCityName) {
                                        pendingCitySwitch = targetCity
                                        showLocationSwitchAuth = true
                                    }
                                }
                                Text(" | ", color = Color.Gray)
                                // Studio Dropdown (Filtered by City)
                                StudioDropdown(cityList.find { it.name == selectedCityName }?.studios ?: emptyList(), selectedStudioName) {
                                    selectedStudioName = it
                                    prefs.edit().putString("selected_studio", it).apply()
                                }
                            } else {
                                Text("$selectedCityName | $selectedStudioName", color = Color.Gray, fontSize = 12.sp)
                            }
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { activeScreen = "laundry_mgmt" }) { Icon(Icons.Default.LocalShipping, null, tint = Gold) }
                    IconButton(onClick = { menuExpanded = true }) { Icon(Icons.Default.MoreVert, null, tint = Gold) }
                    DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }, modifier = Modifier.background(SurfaceBlue)) {
                        DropdownMenuItem(text = { Text("Location Admin", color = Color.White) }, leadingIcon = { Icon(Icons.Default.Settings, null, tint = Gold) }, onClick = { menuExpanded = false; showLocationAdmin = true })
                        DropdownMenuItem(text = { Text("Transfer Item", color = Color.White) }, leadingIcon = { Icon(Icons.AutoMirrored.Filled.Send, null, tint = Gold) }, onClick = { menuExpanded = false; showTransferDialog = true })
                        DropdownMenuItem(text = { Text("Change Password", color = Color.White) }, leadingIcon = { Icon(Icons.Default.Lock, null, tint = Gold) }, onClick = { menuExpanded = false; showChangePassDialog = true })
                        DropdownMenuItem(text = { Text("Clear City Data", color = AlertRed) }, leadingIcon = { Icon(Icons.Default.DeleteForever, null, tint = AlertRed) }, onClick = { menuExpanded = false; showClearDialog = true })
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = NavyBG)
            )
        },
        floatingActionButton = {
            if (activeScreen == "home") {
                ExtendedFloatingActionButton(
                    onClick = { showAddGPDialog = true },
                    containerColor = Gold, contentColor = NavyBG, shape = CircleShape,
                    icon = { Icon(Icons.Default.Add, null) },
                    text = { Text("ADD GP") }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().background(NavyBG).padding(padding)) {
            when (activeScreen) {
                // --- HOME DASHBOARD ---
                "home" -> {
                    Column(Modifier.fillMaxSize().padding(16.dp)) {
                        Row(Modifier.fillMaxWidth().height(70.dp).padding(vertical = 4.dp)) {
                            Button(onClick = { activeScreen = "scan_issue" }, Modifier.weight(1f).fillMaxHeight().padding(end = 4.dp)) { Text("ISSUE", fontWeight = FontWeight.Bold) }
                            Button(onClick = { activeScreen = "scan_return" }, modifier = Modifier.weight(1f).fillMaxHeight().padding(start = 4.dp), colors = ButtonDefaults.buttonColors(containerColor = ComplementaryOrange, contentColor = NavyBG)) { Text("RETURN", fontWeight = FontWeight.Bold) }
                        }
                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                            Button(onClick = { activeScreen = "audit" }, modifier = Modifier.weight(1f).height(65.dp).padding(end = 4.dp), colors = ButtonDefaults.buttonColors(containerColor = AuditGreen)) {
                                Icon(Icons.AutoMirrored.Filled.List, null); Text(" AUDIT")
                            }
                            Button(onClick = { activeScreen = "inventory_levels" }, modifier = Modifier.weight(1f).height(65.dp).padding(start = 4.dp), colors = ButtonDefaults.buttonColors(containerColor = SurfaceBlue)) {
                                Icon(Icons.Default.BarChart, null, tint = Gold); Text(" LEVELS", color = Gold)
                            }
                        }
                        Button(onClick = { activeScreen = "damaged_loss" }, modifier = Modifier.fillMaxWidth().height(60.dp).padding(vertical = 4.dp), colors = ButtonDefaults.buttonColors(containerColor = AlertRed)) {
                            Icon(Icons.Default.ReportProblem, null); Spacer(Modifier.width(8.dp)); Text("DAMAGED / LOSS", fontWeight = FontWeight.Bold)
                        }

                        // Exports & Imports
                        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                            Column(Modifier.weight(1f)) {
                                OutlinedButton(onClick = { invImp.launch(arrayOf("*/*")) }, Modifier.fillMaxWidth().padding(2.dp)) { Text("IMP INV", fontSize = 9.sp) }
                                OutlinedButton(onClick = { invExp.launch(getFileName("Inventory")) }, Modifier.fillMaxWidth().padding(2.dp)) { Text("EXP INV", fontSize = 9.sp) }
                            }
                            Column(Modifier.weight(1f)) {
                                OutlinedButton(onClick = { gpImp.launch(arrayOf("*/*")) }, Modifier.fillMaxWidth().padding(2.dp)) { Text("IMP GP", fontSize = 9.sp) }
                                OutlinedButton(onClick = { issuedExp.launch(getFileName("Issued")) }, Modifier.fillMaxWidth().padding(2.dp)) { Text("EXP ISSUED", fontSize = 9.sp) }
                            }
                            Column(Modifier.weight(1f)) {
                                OutlinedButton(onClick = { activeScreen = "view_logs" }, Modifier.fillMaxWidth().padding(2.dp)) { Text("HISTORY", fontSize = 9.sp) }
                                OutlinedButton(onClick = { logExp.launch(getFileName("History")) }, Modifier.fillMaxWidth().padding(2.dp)) { Text("EXP LOGS", fontSize = 9.sp) }
                            }
                        }

                        // Search
                        OutlinedTextField(value = searchQuery, onValueChange = { searchQuery = it }, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), placeholder = { Text("Search Barcode or Name...") }, leadingIcon = { Icon(Icons.Default.Search, null, tint = Gold) })

                        // List (Filtered by CURRENT STUDIO)
                        LazyColumn(Modifier.weight(1f)) {
                            // 1. Filter by Studio
                            val studioItems = inventory.filter { it.studioLocation == selectedStudioName }

                            // 2. Filter by Search Query
                            val filtered = studioItems.filter {
                                (it.name?.contains(searchQuery, true) == true || it.barcode?.contains(searchQuery) == true) &&
                                        (selectedCategory == "All" || it.category == selectedCategory)
                            }

                            items(filtered) { item ->
                                ListItem(
                                    headlineContent = { Text(item.name ?: "", color = Color.White, fontWeight = FontWeight.Bold) },
                                    supportingContent = { Text("${item.barcode} | ${item.studioLocation}", color = Color.Gray) },
                                    trailingContent = { Text(item.status ?: "", color = if(item.status == "In Stock") Color.Green else Gold) }
                                )
                            }
                        }
                    }
                }

                // --- ISSUE SCREEN (Scoped to Studio) ---
                "scan_issue" -> IssueSessionScreen(gpList, inventory, selectedStudioName, onFinish = { staff, items ->
                    val database = Firebase.database.reference
                    items.forEach { item ->
                        val idx = inventory.indexOfFirst { it.barcode == item.barcode }
                        if (idx != -1) inventory[idx] = inventory[idx].copy(status = "Issued")

                        // Create assignment with push() to get pushKey
                        val assignmentRef = database.child("cities/$selectedCityName/assignments").push()
                        val newAssignment = Assignment(
                            gpName = staff.name,
                            itemName = item.name ?: "",
                            size = item.size ?: "",
                            date = SimpleDateFormat("MM/dd HH:mm").format(Date()),
                            itemBarcode = item.barcode ?: "",
                            studio = selectedStudioName,
                            pushKey = assignmentRef.key
                        )
                        assignmentRef.setValue(mapOf(
                            "id" to newAssignment.id,
                            "gpName" to newAssignment.gpName,
                            "itemName" to newAssignment.itemName,
                            "size" to newAssignment.size,
                            "date" to newAssignment.date,
                            "itemBarcode" to newAssignment.itemBarcode,
                            "studio" to newAssignment.studio
                        ))
                        assignments.add(newAssignment)
                        addLog("ISSUE", "${staff.name} | ${item.name} @ $selectedStudioName")
                    }
                    saveData()
                    activeScreen = "home"
                }, onCancel = { activeScreen = "home" })

                // --- RETURN SCREEN (To Laundry) ---
                "scan_return" -> ReturnSessionScreen(gpList, assignments, inventory, { assign ->
                    val itemIndex = inventory.indexOfFirst { it.barcode == assign.itemBarcode }
                    if (itemIndex != -1) {
                        val item = inventory[itemIndex]
                        val database = Firebase.database.reference

                        // Check Hamper Capacity (soft warning)
                        val cityObj = cityList.find { it.name == selectedCityName }
                        val studioObj = cityObj?.studios?.find { it.name == selectedStudioName }

                        if (studioObj != null) {
                            if (studioObj.currentHamperCount >= studioObj.hamperCapacity) {
                                Toast.makeText(context, "WARNING: Hamper at/over capacity!", Toast.LENGTH_LONG).show()
                            }

                            // Use canonical status "In Laundry" (was "In Hamper")
                            inventory[itemIndex] = item.copy(status = "In Laundry", studioLocation = selectedStudioName)
                            
                            // Use Firebase transaction to safely increment hamper count
                            val hamperRef = database.child("cities/$selectedCityName/studios/${selectedStudioName}/currentHamperCount")
                            hamperRef.runTransaction(object : Transaction.Handler {
                                override fun doTransaction(currentData: MutableData): Transaction.Result {
                                    val currentCount = currentData.getValue(Int::class.java) ?: 0
                                    currentData.value = currentCount + 1
                                    return Transaction.success(currentData)
                                }
                                override fun onComplete(error: DatabaseError?, committed: Boolean, snapshot: DataSnapshot?) {
                                    if (error != null) {
                                        Toast.makeText(context, "Hamper update error: ${error.message}", Toast.LENGTH_SHORT).show()
                                    } else if (committed) {
                                        studioObj.currentHamperCount = snapshot?.getValue(Int::class.java) ?: studioObj.currentHamperCount + 1
                                    }
                                }
                            })

                            // Delete assignment using pushKey if available, fallback to id-based query
                            if (assign.pushKey != null) {
                                database.child("cities/$selectedCityName/assignments/${assign.pushKey}").removeValue()
                            } else {
                                // Fallback: query by id
                                database.child("cities/$selectedCityName/assignments")
                                    .orderByChild("id").equalTo(assign.id)
                                    .addListenerForSingleValueEvent(object : ValueEventListener {
                                        override fun onDataChange(snapshot: DataSnapshot) {
                                            snapshot.children.firstOrNull()?.ref?.removeValue()
                                        }
                                        override fun onCancelled(error: DatabaseError) {
                                            Toast.makeText(context, "Delete error: ${error.message}", Toast.LENGTH_SHORT).show()
                                        }
                                    })
                            }
                            assignments.remove(assign)
                            addLog("RETURN", "${assign.gpName} | ${assign.itemName} -> Laundry")
                            saveData()
                        }
                    }
                }, { activeScreen = "home" })

                // --- LAUNDRY MANAGEMENT ---
                "laundry_mgmt" -> LaundryManagementScreen(
                    cityName = selectedCityName,
                    orders = laundryOrders,
                    studios = cityList.find { it.name == selectedCityName }?.studios ?: emptyList(),
                    returnStudio = laundryReturnStudio,
                    onSetReturnStudio = {
                        laundryReturnStudio = it
                        saveData()
                    },
                    onPickUp = { studio ->
                        val database = Firebase.database.reference
                        // Use canonical status "In Laundry" (was "In Hamper")
                        val toLaundry = inventory.filter { it.status == "In Laundry" && it.studioLocation == studio.name }
                        if (toLaundry.isNotEmpty()) {
                            val orderId = "ORD-${System.currentTimeMillis() % 10000}"
                            val order = LaundryOrder(orderId, toLaundry.map { it.barcode!! }, studio.name, SimpleDateFormat("MM/dd HH:mm").format(Date()))

                            toLaundry.forEach { item ->
                                val idx = inventory.indexOf(item)
                                // Keep status as "In Laundry" during pickup
                                if(idx != -1) inventory[idx] = item.copy(status = "In Laundry")
                            }

                            // Use Firebase transaction to reset hamper count
                            val hamperRef = database.child("cities/$selectedCityName/studios/${studio.name}/currentHamperCount")
                            hamperRef.runTransaction(object : Transaction.Handler {
                                override fun doTransaction(currentData: MutableData): Transaction.Result {
                                    currentData.value = 0
                                    return Transaction.success(currentData)
                                }
                                override fun onComplete(error: DatabaseError?, committed: Boolean, snapshot: DataSnapshot?) {
                                    if (error != null) {
                                        Toast.makeText(context, "Hamper reset error: ${error.message}", Toast.LENGTH_SHORT).show()
                                    } else if (committed) {
                                        studio.currentHamperCount = 0
                                    }
                                }
                            })
                            
                            laundryOrders.add(order)
                            addLog("LAUNDRY", "Pick Up: $orderId from ${studio.name}")
                            saveData()
                        } else {
                            Toast.makeText(context, "Hamper is empty!", Toast.LENGTH_SHORT).show()
                        }
                    },
                    onDropOff = { order ->
                        order.items.forEach { barcode ->
                            val idx = inventory.indexOfFirst { it.barcode == barcode }
                            if (idx != -1) {
                                inventory[idx] = inventory[idx].copy(status = "In Stock", studioLocation = laundryReturnStudio)
                            }
                        }
                        laundryOrders.remove(order)
                        addLog("LAUNDRY", "Drop Off: ${order.id} to $laundryReturnStudio")
                        saveData()
                    },
                    onBack = { activeScreen = "home" }
                )

                // --- OTHER SCREENS ---
                "inventory_levels" -> InventoryLevelsScreen(inventory) { activeScreen = "home" }

                "audit" -> AuditScreen(inventory, onComplete = { diffs ->
                    pendingDiffs = diffs
                    addLog("AUDIT", "Full audit completed")
                    auditReportLauncher.launch(getFileName("AuditReport"))
                    activeScreen = "home"
                }, onCancel = { activeScreen = "home" })

                "damaged_loss" -> DamagedLossScreen(inventory, { item, reason ->
                    inventory.remove(item)
                    addLog("DAMAGED", "${item.name} | $reason")
                    saveData()
                    activeScreen = "home"
                }, { activeScreen = "home" })

                "view_logs" -> LogScreen(auditLogs) { activeScreen = "home" }
            }
        }
    }

    // --- OVERLAY DIALOGS ---

    if (showLocationAdmin) {
        if (!isAdminAuthenticated) {
            PasswordProtectDialog(prefs, onDismiss = { showLocationAdmin = false }) { isAdminAuthenticated = true }
        } else {
            LocationAdminDialog(cityList, onDismiss = { showLocationAdmin = false; isAdminAuthenticated = false }) { updated ->
                cityList.clear(); cityList.addAll(updated); saveData()
            }
        }
    }

    if (showLocationSwitchAuth) {
        PasswordProtectDialog(prefs, onDismiss = { showLocationSwitchAuth = false }) {
            pendingCitySwitch?.let { target ->
                selectedCityName = target
                val newCity = cityList.find { c -> c.name == target }
                selectedStudioName = newCity?.studios?.firstOrNull()?.name ?: ""
                saveData()
            }
            showLocationSwitchAuth = false
        }
    }

    if (showAddGPDialog) {
        ManualGPDialog(onDismiss = { showAddGPDialog = false }) { n, c ->
            gpList.add(GamePresenter(n, c)); saveData(); showAddGPDialog = false
        }
    }

    if (showChangePassDialog) {
        ChangePasswordDialog(prefs.getString("admin_password", "Admin123") ?: "Admin123", { showChangePassDialog = false }) { new ->
            prefs.edit().putString("admin_password", new).apply()
            showChangePassDialog = false
        }
    }

    if (showTransferDialog) {
        TransferItemDialog(inventory, cityList, onDismiss = { showTransferDialog = false }) { item, destCity, destStudio ->
            val idx = inventory.indexOf(item)
            if (destCity == selectedCityName) {
                if (idx != -1) inventory[idx] = item.copy(studioLocation = destStudio)
            } else {
                if (idx != -1) inventory.removeAt(idx)
                val destKey = "${destCity}_inv"
                val destJson = prefs.getString(destKey, "[]")
                val destList: MutableList<UniformItem> = Gson().fromJson(destJson, object : TypeToken<MutableList<UniformItem>>() {}.type)
                destList.add(item.copy(studioLocation = destStudio))
                prefs.edit().putString(destKey, Gson().toJson(destList)).apply()
            }
            addLog("TRANSFER", "${item.name} -> $destCity | $destStudio")
            saveData()
            showTransferDialog = false
        }
    }

    if (showClearDialog) {
        PasswordProtectDialog(prefs, onDismiss = { showClearDialog = false }) {
            inventory.clear(); assignments.clear(); laundryOrders.clear(); auditLogs.clear()
            saveData()
            showClearDialog = false
        }
    }
}

// ==========================================
//              UI COMPONENTS
// ==========================================

@Composable
fun LaundryManagementScreen(
    cityName: String,
    orders: List<LaundryOrder>,
    studios: List<Studio>,
    returnStudio: String,
    onSetReturnStudio: (String) -> Unit,
    onPickUp: (Studio) -> Unit,
    onDropOff: (LaundryOrder) -> Unit,
    onBack: () -> Unit
) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Laundry Management: $cityName", style = MaterialTheme.typography.titleLarge, color = Gold)

        Card(Modifier.fillMaxWidth().padding(vertical = 8.dp), colors = CardDefaults.cardColors(SurfaceBlue)) {
            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Return Destination", color = Color.Gray, fontSize = 12.sp)
                    Text(returnStudio, color = Color.White, fontWeight = FontWeight.Bold)
                }
                var exp by remember { mutableStateOf(false) }
                Box {
                    TextButton(onClick = { exp = true }) { Text("CHANGE") }
                    DropdownMenu(expanded = exp, onDismissRequest = { exp = false }) {
                        studios.forEach { std ->
                            DropdownMenuItem(text = { Text(std.name) }, onClick = { onSetReturnStudio(std.name); exp = false })
                        }
                    }
                }
            }
        }

        Text("Active Hampers", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
        LazyColumn(Modifier.weight(0.4f)) {
            items(studios) { studio ->
                Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(studio.name, color = Color.White)
                        LinearProgressIndicator(
                            progress = studio.currentHamperCount.toFloat() / studio.hamperCapacity.toFloat(),
                            modifier = Modifier.fillMaxWidth().height(6.dp),
                            color = if(studio.currentHamperCount >= studio.hamperCapacity) AlertRed else Gold
                        )
                        Text("${studio.currentHamperCount} / ${studio.hamperCapacity}", fontSize = 10.sp, color = Color.Gray)
                    }
                    Button(onClick = { onPickUp(studio) }, Modifier.padding(start = 12.dp), enabled = studio.currentHamperCount > 0) {
                        Text("Pick Up")
                    }
                }
            }
        }

        Text("In Laundry", color = Color.Gray, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
        LazyColumn(Modifier.weight(0.4f)) {
            items(orders) { order ->
                Card(Modifier.fillMaxWidth().padding(vertical = 4.dp), colors = CardDefaults.cardColors(SurfaceBlue)) {
                    ListItem(
                        headlineContent = { Text(order.id, color = Color.White, fontWeight = FontWeight.Bold) },
                        supportingContent = { Text("${order.items.size} items from ${order.originStudio}", fontSize = 11.sp) },
                        trailingContent = { Button(onClick = { onDropOff(order) }) { Text("Drop Off") } },
                        colors = ListItemDefaults.colors(containerColor = Color.Transparent)
                    )
                }
            }
        }

        Button(onClick = onBack, Modifier.fillMaxWidth()) { Text("Back") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationAdminDialog(cityList: List<City>, onDismiss: () -> Unit, onSave: (List<City>) -> Unit) {
    val tempCities = remember { mutableStateListOf<City>().apply { addAll(cityList) } }
    var selectedCityIdx by remember { mutableIntStateOf(0) }
    var newCityName by remember { mutableStateOf("") }
    var newStudioName by remember { mutableStateOf("") }
    var capInput by remember { mutableStateOf("50") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Location Settings") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Add City
                Row {
                    OutlinedTextField(newCityName, { newCityName = it }, label = { Text("New City") }, modifier = Modifier.weight(1f))
                    IconButton(onClick = { if(newCityName.isNotBlank()) tempCities.add(City(newCityName, emptyList())); newCityName="" }) { Icon(Icons.Default.Add, null) }
                }
                Divider()
                // Select City
                Text("Select City to Edit:", fontSize = 12.sp)
                LazyRow(Modifier.fillMaxWidth()) {
                    items(tempCities.indices.toList()) { idx ->
                        FilterChip(selected = selectedCityIdx == idx, onClick = { selectedCityIdx = idx }, label = { Text(tempCities[idx].name) }, modifier = Modifier.padding(4.dp))
                    }
                }

                // Add Studio
                Text("Add Studio to ${tempCities[selectedCityIdx].name}")
                Row {
                    OutlinedTextField(newStudioName, { newStudioName = it }, label = { Text("Name") }, modifier = Modifier.weight(1f))
                    OutlinedTextField(capInput, { capInput = it }, label = { Text("Cap") }, modifier = Modifier.width(80.dp))
                }
                Button(onClick = {
                    if(newStudioName.isNotBlank()) {
                        val current = tempCities[selectedCityIdx]
                        val updatedStudios = current.studios + Studio(newStudioName, capInput.toIntOrNull() ?: 50)
                        tempCities[selectedCityIdx] = current.copy(studios = updatedStudios)
                        newStudioName = ""
                    }
                }, Modifier.fillMaxWidth()) { Text("Add Studio") }

                // List Studios
                LazyColumn(Modifier.height(100.dp)) {
                    items(tempCities[selectedCityIdx].studios) { std ->
                        Text("• ${std.name} (Hamper: ${std.hamperCapacity})")
                    }
                }
            }
        },
        confirmButton = { Button(onClick = { 
            // Save entire cities map to Firebase to allow deletions
            val database = Firebase.database.reference
            // Clear existing cities and write the entire updated structure
            database.child("cities").setValue(
                tempCities.associate { city ->
                    city.name to mapOf(
                        "studios" to city.studios.associate { studio ->
                            studio.name to mapOf(
                                "hamperCapacity" to studio.hamperCapacity,
                                "currentHamperCount" to studio.currentHamperCount
                            )
                        }
                    )
                }
            )
            onSave(tempCities) 
        }) { Text("Save Changes") } }
    )
}

@Composable
fun IssueSessionScreen(gpList: List<GamePresenter>, inventory: List<UniformItem>, activeStudio: String, onFinish: (GamePresenter, List<UniformItem>) -> Unit, onCancel: () -> Unit) {
    var staff by remember { mutableStateOf<GamePresenter?>(null) }
    val items = remember { mutableStateListOf<UniformItem>() }
    val context = LocalContext.current
    var lastScan by remember { mutableLongStateOf(0L) }

    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(0.4f)) {
            BarcodeScannerView(onBarcodeDetected = { code ->
                if (System.currentTimeMillis() - lastScan > 1000) {
                    lastScan = System.currentTimeMillis()
                    if (staff == null) {
                        gpList.find { it.barcode == code }?.let { staff = it }
                    } else {
                        inventory.find { it.barcode == code }?.let { found ->
                            if (found.status == "In Stock" && found.studioLocation == activeStudio) {
                                if (!items.any { it.barcode == code }) items.add(found)
                            } else if (found.studioLocation != activeStudio) {
                                Toast.makeText(context, "Item belongs to ${found.studioLocation}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
            }, onClose = onCancel)
        }
        Column(Modifier.weight(0.6f).padding(16.dp)) {
            Text(if (staff == null) "SCAN STAFF ID" else "ISSUING TO: ${staff?.name}", color = Gold, fontWeight = FontWeight.Bold)
            Text("Studio: $activeStudio", fontSize = 10.sp, color = Color.Gray)
            LazyColumn(Modifier.weight(1f)) {
                items(items) { item -> ListItem(headlineContent = { Text(item.name ?: "") }) }
            }
            Button(onClick = { onFinish(staff!!, items) }, Modifier.fillMaxWidth(), enabled = staff != null && items.isNotEmpty()) { Text("FINISH") }
        }
    }
}

@Composable
fun ReturnSessionScreen(gpList: List<GamePresenter>, assignments: List<Assignment>, inventory: List<UniformItem>, onReturn: (Assignment) -> Unit, onClose: () -> Unit) {
    var staff by remember { mutableStateOf<GamePresenter?>(null) }
    Column(Modifier.fillMaxSize()) {
        if (staff == null) {
            BarcodeScannerView(onBarcodeDetected = { code -> gpList.find { it.barcode == code }?.let { staff = it } }, onClose = onClose)
        } else {
            val staffItems = assignments.filter { it.gpName == staff?.name }
            Column(Modifier.padding(16.dp)) {
                Text("Returns for ${staff?.name}", color = Gold)
                LazyColumn(Modifier.weight(1f)) {
                    items(staffItems) { assign ->
                        ListItem(headlineContent = { Text(assign.itemName) }, trailingContent = { Button(onClick = { onReturn(assign) }) { Text("Return") } })
                    }
                }
                Button(onClick = onClose, Modifier.fillMaxWidth()) { Text("BACK") }
            }
        }
    }
}

@Composable
fun AuditScreen(inventory: List<UniformItem>, onComplete: (List<AuditDiff>) -> Unit, onCancel: () -> Unit) {
    val counted = remember { mutableStateListOf<String>() }
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(0.4f)) { BarcodeScannerView({ if(!counted.contains(it)) counted.add(it) }, onCancel) }
        Column(Modifier.weight(0.6f).padding(16.dp)) {
            Text("Counted: ${counted.size} / ${inventory.size}", color = Gold)
            Button(onClick = {
                val diffs = inventory.map { i ->
                    val found = counted.contains(i.barcode)
                    AuditDiff(i.name?:"", i.barcode?:"", i.status?:"", if(found) "Found" else "Missing")
                }
                onComplete(diffs)
            }, Modifier.fillMaxWidth()) { Text("Finish Audit") }
        }
    }
}

@Composable
fun InventoryLevelsScreen(inventory: List<UniformItem>, onBack: () -> Unit) {
    val cats = listOf("Jacket", "Vest", "Shirt", "Trousers", "Other")
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("Stock Levels", fontWeight = FontWeight.Bold, color = Gold, fontSize = 20.sp)
        Spacer(Modifier.height(16.dp))
        cats.forEach { cat ->
            val stock = inventory.count { it.category == cat && it.status == "In Stock" }
            val total = inventory.count { it.category == cat }.coerceAtLeast(1)
            Text("$cat: $stock / $total", color = Color.White)
            LinearProgressIndicator(progress = stock.toFloat()/total.toFloat(), Modifier.fillMaxWidth().height(8.dp).padding(vertical = 4.dp))
        }
        Button(onClick = onBack, Modifier.padding(top = 20.dp)) { Text("Back") }
    }
}

@Composable
fun DamagedLossScreen(inventory: List<UniformItem>, onRemove: (UniformItem, String) -> Unit, onCancel: () -> Unit) {
    var item by remember { mutableStateOf<UniformItem?>(null) }
    var reason by remember { mutableStateOf("") }
    if (item == null) {
        BarcodeScannerView({ c -> item = inventory.find { it.barcode == c } }, onCancel)
    } else {
        Column(Modifier.padding(16.dp)) {
            Text("Report Damaged: ${item?.name}", color = AlertRed)
            OutlinedTextField(reason, { reason = it }, label = { Text("Reason") })
            Button(onClick = { onRemove(item!!, reason) }, Modifier.padding(top = 16.dp)) { Text("Confirm Removal") }
        }
    }
}

@Composable
fun LogScreen(logs: List<AuditEntry>, onClose: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row { Text("Logs", color = Gold); Spacer(Modifier.weight(1f)); IconButton(onClick = onClose) { Icon(Icons.Default.Close, null) } }
        LazyColumn { items(logs) { log -> Card(Modifier.padding(4.dp)) { Column(Modifier.padding(8.dp)) { Text(log.action, fontWeight = FontWeight.Bold); Text(log.details, fontSize = 11.sp) } } } }
    }
}

@Composable
fun TransferItemDialog(inventory: List<UniformItem>, cityList: List<City>, onDismiss: () -> Unit, onTransfer: (UniformItem, String, String) -> Unit) {
    var item by remember { mutableStateOf<UniformItem?>(null) }
    var destCity by remember { mutableStateOf(cityList.firstOrNull()?.name ?: "") }
    var destStudio by remember(destCity) {
        mutableStateOf(cityList.find { it.name == destCity }?.studios?.firstOrNull()?.name ?: "")
    }

    AlertDialog(onDismissRequest = onDismiss, title = { Text("Transfer") },
        text = {
            if (item == null) {
                Box(Modifier.height(200.dp)) { BarcodeScannerView({ code -> item = inventory.find { it.barcode == code } }, onDismiss) }
            } else {
                Column {
                    Text("Moving: ${item?.name}")
                    CityDropdown(cityList, destCity) { destCity = it }
                    StudioDropdown(cityList.find { it.name == destCity }?.studios ?: emptyList(), destStudio) { destStudio = it }
                }
            }
        },
        confirmButton = { Button(onClick = { item?.let { onTransfer(it, destCity, destStudio) } }, enabled = item != null && destCity.isNotEmpty() && destStudio.isNotEmpty()) { Text("Confirm") } }
    )
}

@Composable
fun PasswordProtectDialog(prefs: android.content.SharedPreferences, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    var p by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Admin") },
        text = {
            OutlinedTextField(
                value = p,
                onValueChange = { p = it },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrect = false)
            )
        },
        confirmButton = { Button(onClick = { if(p == prefs.getString("admin_password", "Admin123")) onConfirm() }) { Text("Unlock") } })
}

@Composable
fun ChangePasswordDialog(current: String, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var o by remember { mutableStateOf("") }; var n by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Change Password") },
        text = { Column { OutlinedTextField(o, { o = it }, label = { Text("Old") }); OutlinedTextField(n, { n = it }, label = { Text("New") }) } },
        confirmButton = { Button(onClick = { if(o == current) onSave(n) }) { Text("Save") } })
}

@Composable
fun ManualGPDialog(onDismiss: () -> Unit, onConfirm: (String, String) -> Unit) {
    var n by remember { mutableStateOf("") }; var c by remember { mutableStateOf("") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text("Add GP") },
        text = { Column { OutlinedTextField(n, { n = it }, label = { Text("Name") }); OutlinedTextField(c, { c = it }, label = { Text("ID") }) } },
        confirmButton = { Button(onClick = { onConfirm(n, c) }) { Text("Add") } })
}

@Composable
fun CityDropdown(cities: List<City>, selected: String, onSelect: (String) -> Unit) {
    var exp by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { exp = true }) { Text(selected, color = Color.White); Icon(Icons.Default.ArrowDropDown, null, tint = Gold) }
        DropdownMenu(expanded = exp, onDismissRequest = { exp = false }) {
            cities.forEach { city -> DropdownMenuItem(text = { Text(city.name) }, onClick = { onSelect(city.name); exp = false }) }
        }
    }
}

@Composable
fun StudioDropdown(studios: List<Studio>, selected: String, onSelect: (String) -> Unit) {
    var exp by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { exp = true }) { Text(selected, color = Color.White); Icon(Icons.Default.ArrowDropDown, null, tint = Gold) }
        DropdownMenu(expanded = exp, onDismissRequest = { exp = false }) {
            studios.forEach { std -> DropdownMenuItem(text = { Text(std.name) }, onClick = { onSelect(std.name); exp = false }) }
        }
    }
}

// --- HELPER TO FIX CRASH IN DIALOGS ---
fun Context.findActivity(): ComponentActivity? {
    var context = this
    while (context is ContextWrapper) {
        if (context is ComponentActivity) return context
        context = context.baseContext
    }
    return null
}

@Composable
fun BarcodeScannerView(onBarcodeDetected: (String) -> Unit, onClose: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val previewView = remember { PreviewView(context) }
    val scanner = remember {
        BarcodeScanning.getClient(
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_ALL_FORMATS)
                .build()
        )
    }
    // Background executor for image analysis to avoid ANR
    val backgroundExecutor = remember { Executors.newSingleThreadExecutor() }

    DisposableEffect(Unit) {
        onDispose {
            scanner.close()
            backgroundExecutor.shutdown()
        }
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(factory = { previewView }, Modifier.fillMaxSize())

        LaunchedEffect(Unit) {
            val activity = context.findActivity() ?: return@LaunchedEffect
            
            // Obtain camera provider in background to avoid blocking main thread
            val cameraProviderFuture = ProcessCameraProvider.getInstance(activity)
            cameraProviderFuture.addListener({
                try {
                    val cameraProvider = cameraProviderFuture.get()

                    val preview = Preview.Builder()
                        .build()
                        .also { it.setSurfaceProvider(previewView.surfaceProvider) }

                    // Performance optimized image analysis
                    val imageAnalysis = ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                        .setTargetResolution(android.util.Size(640, 480))
                        .build()

                    // Use background executor to avoid main thread blocking
                    imageAnalysis.setAnalyzer(backgroundExecutor) { proxy ->
                        proxy.image?.let { img ->
                            val image = InputImage.fromMediaImage(img, proxy.imageInfo.rotationDegrees)
                            scanner.process(image)
                                .addOnSuccessListener { barcodes ->
                                    barcodes.firstOrNull()?.rawValue?.let { onBarcodeDetected(it) }
                                }
                                .addOnCompleteListener {
                                    proxy.close()
                                }
                        } ?: proxy.close()
                    }

                    // Unbind everything before binding to prevent "Camera already in use" crashes
                    cameraProvider.unbindAll()
                    cameraProvider.bindToLifecycle(
                        lifecycleOwner,
                        CameraSelector.DEFAULT_BACK_CAMERA,
                        preview,
                        imageAnalysis
                    )
                } catch (e: Exception) {
                    // Handle potential binding errors
                    Toast.makeText(context, "Camera error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }, ContextCompat.getMainExecutor(activity))
        }

        IconButton(
            onClick = onClose,
            modifier = Modifier.align(Alignment.TopEnd).padding(16.dp)
        ) {
            Icon(Icons.Default.Close, contentDescription = "Close Scanner", tint = Color.White)
        }
    }
}

// --- CSV UTILS ---

fun importInventoryCsv(context: Context, uri: Uri, currentInventory: SnapshotStateList<UniformItem>, city: String, studio: String, onDone: () -> Unit) {
    var imported = 0
    var duplicates = 0
    try {
        context.contentResolver.openInputStream(uri)?.use { s ->
            BufferedReader(InputStreamReader(s)).use { r ->
                r.readLine() // Header
                var line: String?
                while (r.readLine().also { line = it } != null) {
                    val p = line!!.split(",")
                    if (p.size >= 3) {
                        val barcode = p[2].trim()
                        if (!currentInventory.any { it.barcode == barcode }) {
                            val name = p[0].trim()
                            currentInventory.add(UniformItem(name, p[1].trim(), barcode, "In Stock", determineCategory(name), studio))
                            imported++
                        } else {
                            duplicates++
                        }
                    }
                }
            }
        }
        val message = if (duplicates > 0) {
            "Imported $imported items, skipped $duplicates duplicates"
        } else {
            "Imported $imported items"
        }
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
        onDone()
    } catch (e: Exception) {
        Toast.makeText(context, "Import failed: ${e.message}", Toast.LENGTH_LONG).show()
    }
}

fun importGPCsv(context: Context, uri: Uri, currentGps: SnapshotStateList<GamePresenter>, onDone: () -> Unit) {
    var imported = 0
    try {
        context.contentResolver.openInputStream(uri)?.use { s ->
            BufferedReader(InputStreamReader(s)).use { r ->
                r.readLine()
                var line: String?
                while (r.readLine().also { line = it } != null) {
                    val p = line!!.split(",")
                    if (p.size >= 2) {
                        currentGps.add(GamePresenter(p[0].trim(), p[1].trim()))
                        imported++
                    }
                }
            }
        }
        Toast.makeText(context, "Imported $imported game presenters", Toast.LENGTH_SHORT).show()
        onDone()
    } catch (e: Exception) {
        Toast.makeText(context, "GP import failed: ${e.message}", Toast.LENGTH_SHORT).show()
    }
}

fun exportInventoryCsv(context: Context, uri: Uri, inventory: List<UniformItem>, city: String, studio: String) {
    context.contentResolver.openOutputStream(uri)?.use { os ->
        BufferedWriter(OutputStreamWriter(os)).use { w ->
            w.write("City: $city, Studio: $studio\nName,Size,Barcode,Status,Category,Studio Location\n")
            inventory.forEach { w.write("${it.name},${it.size},${it.barcode},${it.status},${it.category},${it.studioLocation}\n") }
        }
    }
}

fun exportIssuedCsv(context: Context, uri: Uri, assignments: List<Assignment>, city: String, studio: String) {
    context.contentResolver.openOutputStream(uri)?.use { os ->
        BufferedWriter(OutputStreamWriter(os)).use { w ->
            w.write("Location: $city | Studio: $studio\nStaff Name,Item,Size,Barcode,Date Issued,Origin Studio\n")
            assignments.forEach { w.write("${it.gpName},${it.itemName},${it.size},${it.itemBarcode},${it.date},${it.studio}\n") }
        }
    }
}

fun exportMasterLogCsv(context: Context, uri: Uri, logs: List<AuditEntry>, city: String, studio: String) {
    context.contentResolver.openOutputStream(uri)?.use { os ->
        BufferedWriter(OutputStreamWriter(os)).use { w ->
            w.write("Log Export: $city | $studio\nDate,Action,Details\n")
            logs.forEach { w.write("${it.date},${it.action},${it.details}\n") }
        }
    }
}

fun exportAuditReportCsv(context: Context, uri: Uri, diffs: List<AuditDiff>, city: String, studio: String) {
    context.contentResolver.openOutputStream(uri)?.use { os ->
        BufferedWriter(OutputStreamWriter(os)).use { w ->
            w.write("Audit: $city - $studio\nName,Barcode,Status,Audit Result\n")
            diffs.forEach { w.write("${it.name},${it.barcode},${it.expectedStatus},${it.countedStatus}\n") }
        }
    }
}