const { Gateway, Wallets } = require('fabric-network');
const path = require('path');

class FabricClient {
    /**
     * Creates a new Fabric client instance.
     * @param {string} ccpPath - Path to the connection profile JSON file.
     * @param {string} walletPath - Path to the wallet directory.
     * @param {string} identityName - Name of the identity to use.
     */
    constructor(ccpPath, wallet, identityName) {
      this.ccpPath = ccpPath;
      this.wallet = wallet;          // now a MongoWallet instance
      this.identityName = identityName;
      this.ccp = null;
    }
  
    async initialize() {
      this.ccp = require(this.ccpPath);
      // No need to load wallet – it's already passed in
    }
  
    async checkIdentity() {
      return !!(await this.wallet.get(this.identityName));
    }

    /**
     * Submits a transaction (invoke) to the chaincode.
     * @param {string} func - Chaincode function name.
     * @param {...any} args - Function arguments.
     * @returns {Promise<Buffer>} Transaction result as a buffer.
     */
    async submitTransaction(func, endorsingPeers = null, ...args) {
        const gateway = new Gateway();
        try {
            console.log(endorsingPeers);
            await gateway.connect(this.ccp, {
                wallet: this.wallet,
                identity: this.identityName,
                discovery: { enabled: false }
            });
            const network = await gateway.getNetwork('discovery-channel');
            const contract = network.getContract('healthcc');
            
            const transaction = contract.createTransaction(func);
            if (endorsingPeers) {
                transaction.setEndorsingPeers(endorsingPeers);
            }
            return await transaction.submit(...args);
        } finally {
            gateway.disconnect();
        }
    }
    /**
     * Evaluates a query (read-only) transaction.
     * @param {string} func - Chaincode function name.
     * @param {...any} args - Function arguments.
     * @returns {Promise<Buffer>} Query result as a buffer.
     */
    async evaluateTransaction(func, ...args) {
        const gateway = new Gateway();
        try {
            await gateway.connect(this.ccp, {
                wallet: this.wallet,
                identity: this.identityName,
                discovery: { enabled: false }
            });
            const network = await gateway.getNetwork('discovery-channel');
            const contract = network.getContract('healthcc');
            return await contract.evaluateTransaction(func, ...args);
        } finally {
            gateway.disconnect();
        }
    }

    async evaluateTransactionWithTarget(func, targetPeers = null, ...args) {
        const gateway = new Gateway();
        try {
            console.log(targetPeers);
            await gateway.connect(this.ccp, {
                wallet: this.wallet,
                identity: this.identityName,
                discovery: { enabled: false }
            });
            const network = await gateway.getNetwork('discovery-channel');
            const contract = network.getContract('healthcc');
            const transaction = contract.createTransaction(func);
            if (targetPeers) {
                transaction.setEndorsingPeers(targetPeers);
            }
            return await transaction.evaluate(...args);
        } finally {
            gateway.disconnect();
        }
    }

    // ==================== Patient Functions ====================
    async registerPatient(patientId, username, publicKey) {
        return this.submitTransaction('RegisterPatient',  ['peer0.platform.example.com','peer0.patients.example.com'],patientId, username, publicKey);
    }

    async patientExists(patientId) {
        const result = await this.evaluateTransaction('PatientExists', patientId);
        return result.toString() === 'true';
    }

    // ==================== Doctor Functions ====================
    async registerDoctor(doctorId, username, publicKey,hospitalID,hospitalname) {
        let endorsingPeers;
        if (hospitalID!='') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            endorsingPeers = ['peer0.platform.example.com', hospitalPeer];
        } else {
            endorsingPeers = ['peer0.platform.example.com', 'peer0.provider.example.com'];
        }
        console.log("Enorsing peer",endorsingPeers)
        return this.submitTransaction('RegisterDoctor', endorsingPeers,doctorId, username, publicKey,hospitalID);
    }

    async doctorExists(doctorId) {
        const result = await this.evaluateTransaction('DoctorExists', doctorId);
        return result.toString() === 'true';
    }

    // ==================== Hospital Functions ====================    
    async registerHospital(hospitalID, username, collection_name,hospitalname) {
        const hospitalPeer = `peer0.${hospitalname}.example.com`;
        let endorsingPeers = ['peer0.platform.example.com', hospitalPeer];
        console.log(endorsingPeers);
        return this.submitTransaction('RegisterHospital', endorsingPeers,hospitalID, username, collection_name);
    }

    async SetCollection(msp, collection_name) {
        return this.submitTransaction('SetCollectionForMSP', ['peer0.platform.example.com','peer0.citygeneral.example.com'],msp, collection_name);
    }

    async HospitalExists(hospitalID) {
        const result = await this.evaluateTransaction('HospitalExists', hospitalID);
        return result.toString() === 'true';
    }

    // ==================== Appointment Functions ====================
    async createAppointment(
        appointmentId,
        patientId,
        patientName,
        doctorId,
        doctorName,
        doctorSpecialization,
        date,
        timeSlot,
        reason,
        symptoms,
        createdBy = patientId,
        hospitalname='',
        paymentID='',
    ) {
        const symptomsStr = JSON.stringify(symptoms);
        let endorsingPeers= ['peer0.platform.example.com', 'peer0.patients.example.com', 'peer0.provider.example.com'];
        if (hospitalname!='') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            endorsingPeers = ['peer0.platform.example.com', 'peer0.patients.example.com',hospitalPeer];
        } 
        return this.submitTransaction(
            'CreateAppointment',
            endorsingPeers,
            appointmentId,
            paymentID,
            patientId,
            patientName,
            doctorId,
            doctorName,
            doctorSpecialization,
            date,
            timeSlot,
            reason,
            symptomsStr,
            createdBy
        );
    }

    async createQuickAppointment(
        appointmentId,
        patientName,
        patientAge,
        patientEmail,
        patientPhone,
        doctorId,
        doctorName,
        doctorSpecialization,
        date,
        timeSlot,
        reason,
        symptoms,
        createdBy,
        hospitalname='',
        paymentID='',
    ) {
        let endorsingPeers= ['peer0.platform.example.com', 'peer0.provider.example.com'];
        if (hospitalname!='') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            endorsingPeers = ['peer0.platform.example.com', hospitalPeer];
        } 
        const args = [
            appointmentId,
            paymentID,
            patientName,
            patientAge,
            patientEmail,
            patientPhone,
            doctorId,
            doctorName,
            doctorSpecialization,
            date,
            timeSlot,
            reason,
            symptoms,
            createdBy
        ];
        await this.submitTransaction('CreateQuickAppointment', endorsingPeers, ...args);
    }
    async getAppointment(appointmentId) {
        const result = await this.evaluateTransaction('GetAppointmentPublic', appointmentId);
        return JSON.parse(result.toString());
    }

    async getPatientAppointments(patientId) {
        const result = await this.evaluateTransaction('GetPatientAppointments', patientId);
        return JSON.parse(result.toString());
    }

    // ==================== Private Data Functions ====================
    async storePatientPrivateDetails(
        patientId,
        height,
        weight,
        bmi,
        bloodGroup,
        allergies,
        currentMedications,
        chronicConditions,
        familyHistory,
        surgicalHistory,
        medicalHistory,
        emergencyContact,
        endorsingPeers = ['peer0.platform.example.com', 'peer0.patients.example.com'],
    ) {
        // Convert arrays to JSON strings
        const allergiesStr = JSON.stringify(allergies || []);
        const currentMedicationsStr = JSON.stringify(currentMedications || []);
        const chronicConditionsStr = JSON.stringify(chronicConditions || []);
        const surgicalHistoryStr = JSON.stringify(surgicalHistory || []);
    
        return this.submitTransaction(
            'StorePatientPrivateDetails',
            endorsingPeers,
            patientId,
            height.toString(),
            weight.toString(),
            bmi.toString(),
            bloodGroup,
            allergiesStr,
            currentMedicationsStr,
            chronicConditionsStr,
            familyHistory || '',
            surgicalHistoryStr,
            medicalHistory || '',
            emergencyContact || ''
        );
    }
    async getPatientPrivateDetails(patientId,doctorID='') {
       const targetPeer = ['peer0.platform.example.com', 'peer0.patients.example.com'];
       const result = await this.evaluateTransactionWithTarget('GetPatientPrivateDetails', targetPeer, patientId, doctorID);
       const resultString = result.toString();
       const resultObject = JSON.parse(resultString);
       return resultObject;
    }
    
    // ==================== Appointment Queries (Evaluate) ====================
    
    /**
     * Get public appointment details.
     * @param {string} appointmentId
     * @param {string[]} [endorsingPeers] – optional, defaults to profile's endorsers
     * @returns {Promise<Object>} PublicAppointment object
     */
    async getAppointmentPublic(appointmentId) {
        return this.evaluateTransaction('GetAppointmentPublic', appointmentId);
    }
    
    /**
     * Get consultation details for an appointment (private data).
     * @param {string} appointmentId
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<Object>} Consultation object
     */
    async getConsultationByAppointment(appointmentId, endorsingPeers = null) {
        return this.evaluateTransaction('GetConsultationByAppointment',appointmentId);
    }
    
    /**
     * Get appointments for a patient with pagination.
     * @param {string} patientId
     * @param {string} status – filter by status, empty string for all
     * @param {string} startDate – ISO date, empty for no lower bound
     * @param {string} endDate – ISO date, empty for no upper bound
     * @param {number} pageSize – default 10
     * @param {string} bookmark – pagination bookmark from previous call
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<Object>} { appointments: [], bookmark: "" }
     */
    async getPatientAppointments(patientId, status = '', startDate = '', endDate = '', pageSize = 10, bookmark = '', endorsingPeers = null) {
        const args = [patientId, status, startDate, endDate, pageSize.toString(), bookmark];
        return this.evaluateTransaction('GetPatientAppointments', ...args);
    }
    
    /**
     * Get appointments for a doctor with pagination.
     * @param {string} doctorId
     * @param {string} status
     * @param {string} startDate
     * @param {string} endDate
     * @param {number} pageSize
     * @param {string} bookmark
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<Object>}
     */
    async getDoctorAppointments(doctorId, status = '', startDate = '', endDate = '', pageSize = 10, bookmark = '',patientName='' ,hospitalname='') {
        let targetPeer=['peer0.platform.example.com', 'peer0.provider.example.com','peer0.patients.example.com'];
        if (hospitalname!='') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            targetPeer = ['peer0.platform.example.com', hospitalPeer,'peer0.patients.example.com'];
        }
        const args = [doctorId, status, startDate, endDate, pageSize.toString(), bookmark,patientName];
        console.log(args);
        const result= await this.evaluateTransactionWithTarget('GetDoctorAppointmentscheck', targetPeer, ...args);
        const resultString = result.toString();
        const resultObject = JSON.parse(resultString);
        return resultObject;
    }

    async getDoctorAppointmentsPaginated(doctorID, status='', startDate='', endDate='', patientName='', pageSize=10, bookmark='',hospitalname='') {
        let targetPeer=['peer0.platform.example.com', 'peer0.provider.example.com','peer0.patients.example.com'];
        if (hospitalname!='') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            targetPeer = ['peer0.platform.example.com', hospitalPeer,'peer0.patients.example.com'];
        }
        console.log(targetPeer);
        const result = await this.evaluateTransactionWithTarget(
            'GetDoctorAppointmentsPaginated',
            targetPeer,
            doctorID,
            status,
            startDate,
            endDate,
            patientName,
            pageSize.toString(),
            bookmark
        );
        console.log(result.toString());
        const resultString = result.toString();
        const resultObject = JSON.parse(resultString);
        return resultObject;
    }
    
    /**
     * Get appointments for a hospital with pagination.
     * @param {string} hospitalId
     * @param {string} doctorId – optional, empty for all
     * @param {string} status – optional
     * @param {string} startDate – optional
     * @param {string} endDate – optional
     * @param {number} pageSize
     * @param {string} bookmark
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<Object>}
     */
    async getHospitalAppointments(hospitalId, doctorId = '', status = '', startDate = '', endDate = '', pageSize = 10, bookmark = '', endorsingPeers = null) {
        const args = [hospitalId, doctorId, status, startDate, endDate, pageSize.toString(), bookmark];
        return this.evaluateTransaction('GetHospitalAppointments', endorsingPeers, ...args);
    }
    
    /**
     * Get full patient data (public + private + latest vitals).
     * @param {string} patientId
     * @param {string} doctorId – required for doctor access
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<Object>} PatientFullData
     */
    async getPatientFullData(patientId, doctorId = '', endorsingPeers = null) {
        return this.evaluateTransaction('GetPatientFullData', patientId, doctorId);
    }

    /**
     * Fetch full appointment details (public + private) by appointment ID.
     * @param {string} appointmentId - ID of the appointment
     * @returns {Promise<Object>} Object with { public, private } where private may be null.
     */
    async getFullAppointment(appointmentId,hospitalname='') {
        let targetPeer=['peer0.platform.example.com', 'peer0.provider.example.com'];
        if (hospitalname!='') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            targetPeer = ['peer0.platform.example.com', hospitalPeer];
        }
        // For a query, any peer can serve; use the same target as before.
        const result = await this.evaluateTransactionWithTarget(
            'GetFullAppointment',
            targetPeer,
            appointmentId
        );
        const resultString = result.toString();
        return JSON.parse(resultString);
    }
    
    /**
     * Get patient appointments with full details (public + private).
     * @param {string} patientId
     * @param {string} startDate
     * @param {string} endDate
     * @param {string} status
     * @param {number} pageSize
     * @param {string} bookmark
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<Object>} PaginatedAppointmentsWithDetails
     */
    async getPatientAppointmentsWithDetails(patientId, doctortID,startDate = '', endDate = '', status = '', pageSize = 10, bookmark = '', endorsingPeers = null) {
        const args = [patientId,doctortID, startDate, endDate, status, pageSize.toString(), bookmark];
        return this.evaluateTransaction('GetPatientAppointmentsWithDetails', ...args);
    }
    
    // ==================== Appointment Updates (Invoke) ====================
    
    /**
     * Update the status of an appointment.
     * @param {string} appointmentId
     * @param {string} newStatus – one of: scheduled, confirmed, checked-in, in-consultation, completed, cancelled, no-show
     * @param {string[]} [endorsingPeers] – must include peers that hold the private data
     * @returns {Promise<void>}
     */
    async updateAppointmentStatus(appointmentId, newStatus,hospitalname='') {
        let targetPeer=['peer0.platform.example.com','peer0.patients.example.com' ,'peer0.provider.example.com'];
        if (hospitalname!='') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            targetPeer = ['peer0.platform.example.com','peer0.patients.example.com', hospitalPeer];
        }
        return this.submitTransaction('UpdateAppointmentStatus', targetPeer, appointmentId, newStatus);
    }
    
    /**
     * Create a consultation for a completed appointment (private data).
     * @param {string} appointmentId
     * @param {string} diagnosis
     * @param {Array<Object>} prescriptions – array of prescription objects
     * @param {string} notes
     * @param {string} followUpDate
     * @param {string[]} testsRecommended
     * @param {Object} vitalSigns – e.g., { bloodPressure: "120/80", heartRate: 72, ... }
     * @param {string} doctorId – the attending doctor's certificate ID
     * @param {string[]} [endorsingPeers] – must include peers that hold the private data
     * @returns {Promise<void>}
     */
    async createConsultation(appointmentId, diagnosis, prescriptions, notes, followUpDate, testsRecommended, vitalSigns, doctorId, hospitalname = '') {
        let targetPeer = ['peer0.platform.example.com', 'peer0.patients.example.com', 'peer0.provider.example.com'];
        if (hospitalname != '') {
            const hospitalPeer = `peer0.${hospitalname}.example.com`;
            targetPeer = ['peer0.platform.example.com', 'peer0.patients.example.com', hospitalPeer];
        }
        // Stringify all complex arguments
        return this.submitTransaction('CreateConsultation', targetPeer,
            appointmentId,
            diagnosis,
            JSON.stringify(prescriptions),   // []Prescription
            notes,
            followUpDate,
            JSON.stringify(testsRecommended), // []string
            JSON.stringify(vitalSigns),       // VitalSigns  <-- FIX: stringify
            doctorId
        );
    }

    // ==================== Access Control Functions ====================
    
    /**
     * Grant a doctor access to a patient's data.
     * @param {string} permissionId – unique permission ID
     * @param {string} patientId – patient's certificate ID
     * @param {string} doctorId – doctor's certificate ID
     * @param {string} accessLevel – e.g., "read", "write", "full"
     * @param {string[]} dataTypes – array of data types, e.g., ["medical_history","allergies"]
     * @param {string} expiresAt – ISO timestamp
     * @param {string[]} [endorsingPeers] – optional, defaults to profile endorsers
     * @returns {Promise<void>}
     */
    async grantAccess(permissionId, patientId, doctorId, accessLevel, dataTypes, expiresAt, endorsingPeers = null) {
        const dataTypesStr = JSON.stringify(dataTypes);
        return this.submitTransaction('GrantAccess', endorsingPeers, permissionId, patientId, doctorId, accessLevel, dataTypesStr, expiresAt);
    }
    
    /**
     * Grant temporary access for a specific appointment (auto‑expires after appointment).
     * @param {string} patientId – patient's certificate ID
     * @param {string} appointmentId – the appointment ID
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<void>}
     */
    async grantAccessForAppointment(patientId, appointmentId, endorsingPeers = null) {
        return this.submitTransaction('GrantAccessForAppointment', endorsingPeers, patientId, appointmentId);
    }
    
    /**
     * Revoke a specific permission by its ID.
     * @param {string} permissionId
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<void>}
     */
    async revokeAccess(permissionId, endorsingPeers = null) {
        return this.submitTransaction('RevokeAccess', endorsingPeers, permissionId);
    }
    
    /**
     * Revoke all permissions granted to a doctor by a patient.
     * @param {string} patientId – patient's certificate ID
     * @param {string} doctorId – doctor's certificate ID
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<void>}
     */
    async revokeAllAccess(patientId, doctorId, endorsingPeers = null) {
        return this.submitTransaction('RevokeAllAccess', endorsingPeers, patientId, doctorId);
    }
    
    // ==================== Access Control (Query) ====================
    
    /**
     * Check if a doctor has active access to a patient's data.
     * @param {string} patientId
     * @param {string} doctorId
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<boolean>}
     */
    async checkDoctorAccess(patientId, doctorId) {
        let targetPeer=['peer0.platform.example.com', 'peer0.patients.example.com'];
        const result = await this.evaluateTransactionWithTarget('CheckDoctorAccess',targetPeer,  patientId, doctorId);
        return result.toString() === 'true';
    }
    
    /**
     * Verify if a permission is still active (not expired or revoked).
     * @param {string} permissionId
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<boolean>}
     */
    async verifyAccess(permissionId, endorsingPeers = null) {
        const result = await this.evaluateTransaction('VerifyAccess', permissionId);
        return result.toString() === 'true';
    }
    
    /**
     * Get all permissions granted by a patient.
     * @param {string} patientId
     * @param {string[]} [endorsingPeers]
     * @returns {Promise<Array>} Array of AccessPermission objects
     */
    async getPatientPermissions(patientId, endorsingPeers = null) {
        const result = await this.evaluateTransaction('GetPatientPermissions', patientId);
        return JSON.parse(result.toString());
    }
}

module.exports = FabricClient;