# 🔄 Database Interface - Data Migration Feature

## 📋 **Overview**

Enable users to **export**, **import**, and **migrate** data between canisters using JSON in the Database Interface.

---

## 🎯 **Use Cases**

1. **Backup & Restore**
   - Export production data as JSON backup
   - Restore data if something goes wrong

2. **Environment Migration**
   - Export from development canister
   - Import to production canister

3. **Data Seeding**
   - Create sample data in JSON
   - Import to initialize a new canister

4. **Cross-Project Migration**
   - Export data from old project structure
   - Transform JSON schema
   - Import to new project structure

5. **Disaster Recovery**
   - Regular JSON exports as insurance
   - Quick restore in case of canister issues

---

## 🎨 **UI Design**

### **New Toolbar Buttons (JSON View)**

```
┌─────────────────────────────────────────────────┐
│ 🗄️ Database Interface     [🔐 ADMIN ACCESS]    │
│                                                 │
│ [Form] [Table] [Query] [JSON] ← Views          │
│                                                 │
│ [📥 Import JSON] [📤 Export JSON] [🔄 Migrate] │ ← NEW
│                                                 │
│ {                                               │
│   "tasks": [...],                               │
│   "projects": [...],                            │
│   "teamMembers": [...]                          │
│ }                                               │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ **Implementation**

### **1. Export Feature**

```typescript
// In DatabaseInterface.tsx

const handleExportData = useCallback(() => {
  try {
    // Get current data from state
    const dataToExport = databaseState.data;
    
    // Add metadata for migration
    const exportPayload = {
      _metadata: {
        exportedAt: new Date().toISOString(),
        canisterId: selectedServerPair?.backendCanisterId,
        projectName: projectName,
        version: '1.0',
        schema: databaseState.schema?.sections.map(s => ({
          name: s.name,
          fields: s.properties
        }))
      },
      data: dataToExport
    };
    
    // Convert to JSON
    const jsonString = JSON.stringify(exportPayload, (key, val) => {
      // Handle BigInt
      if (typeof val === 'bigint') {
        return val.toString() + 'n'; // Mark as BigInt
      }
      return val;
    }, 2);
    
    // Create download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    addDeploymentLog(`✅ Exported ${Object.keys(dataToExport).length} data sections`);
    
  } catch (error) {
    console.error('Export failed:', error);
    setDatabaseState(prev => ({
      ...prev,
      error: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));
  }
}, [databaseState.data, databaseState.schema, selectedServerPair, projectName]);
```

### **2. Import Feature**

```typescript
// In DatabaseInterface.tsx

const handleImportData = useCallback(async (file: File) => {
  try {
    setDatabaseState(prev => ({ ...prev, isLoading: true }));
    
    // Read file
    const fileContent = await file.text();
    const importPayload = JSON.parse(fileContent, (key, val) => {
      // Restore BigInt
      if (typeof val === 'string' && val.endsWith('n')) {
        return BigInt(val.slice(0, -1));
      }
      return val;
    });
    
    // Extract data (handle both with and without metadata wrapper)
    const importedData = importPayload.data || importPayload;
    
    // Validation: Check schema compatibility
    if (importPayload._metadata?.schema) {
      const currentSections = databaseState.schema?.sections.map(s => s.name) || [];
      const importedSections = Object.keys(importedData);
      const incompatible = importedSections.filter(s => !currentSections.includes(s));
      
      if (incompatible.length > 0) {
        const proceed = window.confirm(
          `Warning: Imported data contains sections not in current schema:\n` +
          `${incompatible.join(', ')}\n\n` +
          `These sections will be ignored. Continue?`
        );
        if (!proceed) {
          setDatabaseState(prev => ({ ...prev, isLoading: false }));
          return;
        }
      }
    }
    
    // Merge or replace?
    const mode = await new Promise<'merge' | 'replace'>((resolve) => {
      const choice = window.confirm(
        'Import Mode:\n\n' +
        'OK = MERGE with existing data\n' +
        'Cancel = REPLACE all data'
      );
      resolve(choice ? 'merge' : 'replace');
    });
    
    let finalData: Record<string, any>;
    
    if (mode === 'merge') {
      // Merge: Combine arrays, overwrite objects
      finalData = { ...databaseState.data };
      Object.keys(importedData).forEach(key => {
        if (Array.isArray(importedData[key]) && Array.isArray(finalData[key])) {
          // Merge arrays (avoid duplicates by ID if present)
          const existing = finalData[key];
          const imported = importedData[key];
          
          // Try to detect ID field
          const idField = imported[0]?.id !== undefined ? 'id' : null;
          
          if (idField) {
            const existingIds = new Set(existing.map((item: any) => item[idField]));
            const newItems = imported.filter((item: any) => !existingIds.has(item[idField]));
            finalData[key] = [...existing, ...newItems];
          } else {
            // No ID field, just append
            finalData[key] = [...existing, ...imported];
          }
        } else {
          // Replace non-array data
          finalData[key] = importedData[key];
        }
      });
    } else {
      // Replace mode
      finalData = importedData;
    }
    
    // Update state
    handleDataChange(finalData);
    
    setDatabaseState(prev => ({
      ...prev,
      isLoading: false,
      error: null
    }));
    
    // Show success message
    const importedSections = Object.keys(importedData).length;
    const totalItems = Object.values(importedData).reduce((sum, val) => {
      return sum + (Array.isArray(val) ? val.length : 0);
    }, 0);
    
    alert(
      `✅ Import Successful!\n\n` +
      `Mode: ${mode.toUpperCase()}\n` +
      `Sections: ${importedSections}\n` +
      `Total Items: ${totalItems}\n\n` +
      `Don't forget to SAVE to persist changes!`
    );
    
  } catch (error) {
    console.error('Import failed:', error);
    setDatabaseState(prev => ({
      ...prev,
      isLoading: false,
      error: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));
  }
}, [databaseState.data, databaseState.schema, handleDataChange]);

// File input handler
const handleImportClick = useCallback(() => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      handleImportData(file);
    }
  };
  input.click();
}, [handleImportData]);
```

### **3. Cross-Canister Migration Feature**

```typescript
// In DatabaseInterface.tsx

const handleMigrateData = useCallback(async () => {
  try {
    // Step 1: Export current data
    const currentData = databaseState.data;
    
    // Step 2: Show migration dialog
    const targetCanisterId = window.prompt(
      'Enter target canister ID to migrate data to:\n\n' +
      'Note: You must have write access to the target canister.'
    );
    
    if (!targetCanisterId) return;
    
    // Step 3: Validate target canister
    setDatabaseState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Create actor for target canister
      const { HttpAgent, Actor } = await import('@dfinity/agent');
      const agent = new HttpAgent({
        identity: identity!,
        host: 'https://icp0.io'
      });
      
      // Try to fetch target canister's IDL
      // (This assumes target uses same actor name)
      const didJsFile = Object.entries(combinedProjectFiles).find(([name]) => 
        name.endsWith('.did.js')
      );
      
      if (!didJsFile) {
        throw new Error('No .did.js file found - cannot connect to target canister');
      }
      
      const targetActor = await DynamicCanisterService.createActor({
        canisterId: targetCanisterId,
        identity: identity!,
        candidContent: didJsFile[1],
        didDtsContent: undefined
      });
      
      if (!targetActor) {
        throw new Error('Failed to create actor for target canister');
      }
      
      // Step 4: Discover target methods
      const targetMethodInfo = await CanisterMethodDiscovery.discoverMethods(
        targetActor,
        didJsFile[1],
        true
      );
      
      // Step 5: Migrate data section by section
      let migratedSections = 0;
      let migratedItems = 0;
      
      for (const [sectionName, sectionData] of Object.entries(currentData)) {
        if (!Array.isArray(sectionData) || sectionData.length === 0) {
          console.log(`⏭️ Skipping empty section: ${sectionName}`);
          continue;
        }
        
        // Find appropriate setter method
        const setterName = `create${sectionName.charAt(0).toUpperCase() + sectionName.slice(1, -1)}`;
        const setter = targetMethodInfo.setters.find(s => s.name === setterName);
        
        if (!setter) {
          console.warn(`⚠️ No setter found for ${sectionName} (tried ${setterName})`);
          continue;
        }
        
        // Migrate each item
        for (const item of sectionData) {
          try {
            const result = await targetActor[setter.name](item);
            
            if (result && 'ok' in result) {
              migratedItems++;
            } else if (result && 'err' in result) {
              console.warn(`Failed to migrate item:`, result.err);
            }
          } catch (itemError) {
            console.error(`Error migrating item:`, itemError);
          }
        }
        
        migratedSections++;
      }
      
      setDatabaseState(prev => ({ ...prev, isLoading: false }));
      
      alert(
        `✅ Migration Complete!\n\n` +
        `Target: ${targetCanisterId}\n` +
        `Sections: ${migratedSections}\n` +
        `Items: ${migratedItems}\n\n` +
        `Data has been written to the target canister.`
      );
      
    } catch (migrationError) {
      setDatabaseState(prev => ({
        ...prev,
        isLoading: false,
        error: `Migration failed: ${migrationError instanceof Error ? migrationError.message : 'Unknown error'}`
      }));
    }
    
  } catch (error) {
    console.error('Migration setup failed:', error);
    setDatabaseState(prev => ({
      ...prev,
      error: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));
  }
}, [databaseState.data, identity, combinedProjectFiles]);
```

### **4. Add Buttons to UI**

```typescript
// In DatabaseInterface.tsx render method

{activeView === 'json' && (
  <>
    {/* Migration Toolbar */}
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      padding: '1rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      background: 'rgba(0, 0, 0, 0.2)'
    }}>
      <button
        onClick={handleExportData}
        style={{
          padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        📤 Export JSON
      </button>
      
      <button
        onClick={handleImportClick}
        style={{
          padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        📥 Import JSON
      </button>
      
      <button
        onClick={handleMigrateData}
        style={{
          padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        🔄 Migrate to Canister
      </button>
      
      <div style={{ flex: 1 }} />
      
      <div style={{
        padding: '0.5rem 1rem',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        fontSize: '0.875rem',
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        💡 Tip: Export for backup, Import to seed data, Migrate to copy between canisters
      </div>
    </div>
    
    <JsonEditor
      value={databaseState.data}
      onChange={handleDataChange}
      readOnly={false}
    />
  </>
)}
```

---

## 📊 **Export Format**

### **Full Export (with metadata):**
```json
{
  "_metadata": {
    "exportedAt": "2026-01-04T10:00:00.000Z",
    "canisterId": "kpqqe-2qaaa-aaaaa-qdmqq-cai",
    "projectName": "Project Management App",
    "version": "1.0",
    "schema": [
      {
        "name": "tasks",
        "fields": ["id", "title", "status", "assignedTo", "dueDate"]
      },
      {
        "name": "projects",
        "fields": ["id", "name", "status", "owner", "created"]
      }
    ]
  },
  "data": {
    "tasks": [
      {
        "id": "1n",
        "title": "Implement database migration",
        "status": { "InProgress": null },
        "assignedTo": "es...",
        "dueDate": "1768473600000000000n",
        "created": "1767523212886520976n"
      }
    ],
    "projects": [
      {
        "id": "1n",
        "name": "Q1 Feature Development",
        "status": { "Active": null },
        "owner": "es...",
        "created": "1767523212886520976n"
      }
    ],
    "teamMembers": []
  }
}
```

---

## 🎯 **Benefits**

### **For Developers:**
✅ **Quick backups** - JSON files are human-readable  
✅ **Version control** - Commit data snapshots to git  
✅ **Easy debugging** - Inspect/edit data offline  
✅ **Seeding** - Create test data once, reuse everywhere  

### **For Operations:**
✅ **Disaster recovery** - Fast restore from JSON  
✅ **Data portability** - Move between environments  
✅ **Compliance** - Export for audits/legal  
✅ **Analytics** - Export to external tools  

### **For Users:**
✅ **Data ownership** - Users can download their data  
✅ **Migration** - Easy to switch between projects  
✅ **Collaboration** - Share data files with team  

---

## 🔒 **Security Considerations**

1. **Access Control**
   - Only allow export if user has read access
   - Only allow import if user has write access
   - Migrations require admin/owner access

2. **Data Validation**
   - Validate imported JSON schema
   - Check for malicious data injection
   - Verify BigInt conversions

3. **Audit Trail**
   - Log all import/export/migrate operations
   - Include user principal in logs
   - Track data modifications

---

## 🚀 **Future Enhancements**

1. **Scheduled Exports**
   - Automatic daily/weekly backups
   - Store in user's canister storage

2. **Transformation Pipelines**
   - Map old schema → new schema
   - Custom JS transformations
   - Field renaming/restructuring

3. **Diff/Merge Tools**
   - Visual comparison of data
   - Selective merge (cherry-pick items)
   - Conflict resolution

4. **Bulk Operations**
   - Export multiple canisters at once
   - Parallel migration
   - Progress tracking

---

## ✅ **Implementation Checklist**

- [ ] Add export button to JSON view
- [ ] Implement JSON download with metadata
- [ ] Add import button with file picker
- [ ] Implement merge vs replace logic
- [ ] Add schema compatibility validation
- [ ] Implement BigInt serialization
- [ ] Add cross-canister migration
- [ ] Test with large datasets
- [ ] Add progress indicators
- [ ] Document migration process
- [ ] Add error recovery
- [ ] Test admin access requirements

---

**Would you like me to implement this feature now?** 🚀

