const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, default: 'India' }
});

const patientSchema = new mongoose.Schema({
  // Basic Information
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  patient_id: { 
    type: String, 
    required: false,
    trim: true,
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  phoneNo: { 
    type: String, 
    required: true,
  },
  aadharCardNo: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v) {
        return /^\d{12}$/.test(v);
      },
      message: 'Aadhar must be 12 digits'
    }
  },
  password: { 
    type: String, 
    required: true 
  },

  // Profile Information
  dateOfBirth: { type: Date },
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'] 
  },
  bloodGroup: { 
    type: String, 
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] 
  },
  
  // Physical Attributes
  weight: { type: Number }, // in kg
  height: { type: Number }, // in cm
  bmi: { type: Number },

  // Address
  address: addressSchema,

  // Medical Information
  medicalHistory: { type: String },
  allergies: [String],
  currentMedications: [String],
  chronicConditions: [String],
  familyHistory: { type: String },
  surgicalHistory: [String],

  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNo: String,
    email: String
  },

  // Profile Completion
  profileCompleted: { type: Boolean, default: false },
  profilePhoto: {
    type: String,
    default: 'https://www.w3schools.com/howto/img_avatar.png', 
  },
  blockchainStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  blockchainError: { type: String },
  // Blockchain Reference
  blockchainPatientId: { type: String },
  publicKey: { type: String },

  
  // Appointment IDs with status
  appointmentReferences: [{
    appointmentId: { 
      type: String, 
      ref: 'Appointment',
      required: true 
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'],
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
});

// Indexes
patientSchema.index({ username: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ aadharCardNo: 1 });
patientSchema.index({ phoneNo: 1 });
patientSchema.index({ 'appointmentReferences.appointmentId': 1 });
patientSchema.index({ 'appointmentReferences.status': 1 });

// Middleware to update updatedAt
patientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for age calculation
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});


const qualificationSchema = new mongoose.Schema({
  degree: { type: String, required: true },
  institution: { type: String, required: true },
  year: { type: Number, required: true },
  certificateUrl: { type: String }
});


// Schema for hospital address (optional)
const hospitalAddressSchema = new mongoose.Schema({
  street: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, trim: true, default: 'India' }
});

// Main Hospital schema
const hospitalSchema = new mongoose.Schema({
  // Unique identifier for the hospital (like username)
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    index: true
  },
  // Display name of the hospital
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Password for authentication
  password: {
    type: String,
    required: true
  },
  // MSP ID from the blockchain network (e.g., "citygeneralMSP")
  mspId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  collectionname:{
    type: String,
    required: true,
    trim: true,
    index: true
  },
  tier: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  phoneNo: {
    type: String,
    trim: true,
  },
  address: {
    type: hospitalAddressSchema,
    default: {}
  },
  profilePhoto: {
    type: String,
    default: 'https://www.w3schools.com/howto/img_avatar.png'
  },
  isVerified: {
    type: Boolean,
    default: true
  },
  // Optional reference to the blockchain wallet path (if needed)
  walletpath: {
    type: String,
    trim: true
  },
  // Statistics (optional)
  stats: {
    totalDoctors: { type: Number, default: 0 },
    totalAppointments: { type: Number, default: 0 },
    totalConsultations: { type: Number, default: 0 }
  },
  // References to doctors belonging to this hospital (by their MSP ID)
  // This is not a direct reference, but we can store an array of doctor IDs if needed
  doctorReferences: [{
    doctorId: { type: String, required: true, index: true }, // blockchain doctor ID
    name: { type: String, trim: true }
  }],
  // Appointment references (optional – for quick lookups)
  appointmentReferences: [{
    appointmentId: { type: String, required: true, index: true },
    doctorId: { type: String, required: true },
    patientId: { type: String, required: true },
    status: { type: String, enum: ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'] },
    date: { type: Date, index: true },
    timeSlot: { type: String }
  }],
  blockchainStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
hospitalSchema.index({ email: 1 });
hospitalSchema.index({ mspId: 1 });
hospitalSchema.index({ tier: 1 });
hospitalSchema.index({ 'appointmentReferences.appointmentId': 1 });
hospitalSchema.index({ 'appointmentReferences.date': 1 });
hospitalSchema.index({ 'doctorReferences.doctorId': 1 });

// Middleware to update the `updatedAt` field on save
hospitalSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Hospital', hospitalSchema);

const doctorSchema = new mongoose.Schema({
  // Basic Information
  username: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  hospital_id: { 
    type: String, 
    trim: true,
    lowercase: true,
    default: ''
  },
  hospital_name:{
    type: String, 
    trim: true,
    lowercase: true,
    default: ''
  },
  walletpath: { 
    type: String, 
    required: false, 
    unique: false,
    trim: false
  },  
  collectionname:{
    type: String,
    required: true,
    trim: true,
    index: true
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  phoneNo: { 
    type: String, 
    required: true,
  },
  password: { 
    type: String, 
    required: true 
  },

  // Professional Information
  registrationNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  consultationFee: { type: Number, default: 500 },
  specialization: { 
    type: String, 
    enum: [
      'Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 
      'General Physician', 'Gynecology', 'Neurology', 'Oncology', 
      'Orthopedics', 'Pediatrics', 'Psychiatry', 'Radiology', 'Urology',
      'Dentistry', 'ENT', 'Ophthalmology', 'Physiotherapy'
    ]
  },
  subSpecialization: [String],
  
  // Qualifications
  qualifications: [qualificationSchema],
  
  // Experience
  totalExperience: { type: Number }, // in years
  bio: { type: String },
  languages: [String],
  
  // Personal Information
  dateOfBirth: { type: Date },
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Other', 'Prefer not to say'] 
  },
  
  // Address
  address: addressSchema,
  
  // ========== SCHEDULE MANAGEMENT ==========

  weeklySchedule: [{
    day: { 
      type: String, 
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      required: true 
    },
    isWorking: { type: Boolean, default: false },
    slots: [{
      startTime: { type: String, required: true }, // "09:00"
      endTime: { type: String, required: true },   // "10:00"
      maxPatients: { type: Number, default: 10 }
    }]
  }],
  
  // Date-specific Overrides
  scheduleOverrides: [{
    date: { 
      type: Date, 
      required: true,
      index: true 
    },
    isWorking: { type: Boolean, default: false },
    reason: String,
    slots: [{
      startTime: String,
      endTime: String,
      maxPatients: { type: Number, default: 10 }
    }]
  }],
  
  // Blocked Slots
  blockedSlots: [{
    date: { 
      type: Date, 
      required: true,
      index: true 
    },
    timeSlot: { type: String, required: true }, // "09:00-10:00"
    reason: String,
    blockedAt: { type: Date, default: Date.now }
  }],

  // ========== PROFILE & VERIFICATION ==========
  profileCompleted: { type: Boolean, default: false },
  profilePhoto: {
    type: String,
    default: 'https://www.w3schools.com/howto/img_avatar.png', // default human figure image
  },
  isVerified: { type: Boolean, default: true },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'verified'
  },
  
  // ========== BLOCKCHAIN ==========
  blockchainDoctorId: { type: String },
  publicKey: { type: String },
  mspId: { type: String },
  
  // ========== STATISTICS ==========
  stats: {
    totalPatients: { type: Number, default: 0 },
    totalAppointments:{type: Number, default: 0},
    totalConsultations: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 }
  },
  blockchainStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },

  
  // ========== SETTINGS ==========
  settings: {
    autoConfirmAppointments: { type: Boolean, default: true },
    sendNotifications: { type: Boolean, default: true },
    maxPatientsPerDay: { type: Number, default: 20, min: 1 },
    maxPatientsPerSlot: { type: Number, default: 1, min: 1 },
    slotDuration: { type: Number, default: 15, min: 10 } // in minutes
  },

  // ========== APPOINTMENT REFERENCES ==========
  appointmentReferences: [{
    appointmentId: { 
      type: String, 
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'],
      required: true
    },
    patientId: {
      type: String,
      required: true
    },
    patientName: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    timeSlot: {
      type: String,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});


// Indexes for efficient queries
doctorSchema.index({ username: 1 });
doctorSchema.index({ email: 1 });
doctorSchema.index({ registrationNumber: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ isVerified: 1 });
doctorSchema.index({ hospital_id: 1 });
doctorSchema.index({ 'appointmentReferences.appointmentId': 1 });
doctorSchema.index({ 'appointmentReferences.status': 1 });
doctorSchema.index({ 'appointmentReferences.date': 1 });
doctorSchema.index({ 'appointmentReferences.patientId': 1 });
doctorSchema.index({ 'scheduleOverrides.date': 1 });
doctorSchema.index({ 'blockedSlots.date': 1 });
doctorSchema.index({ specialization: 1, isVerified: 1 });

// Middleware to update updatedAt
doctorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for age calculation
doctorSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});


const appointmentSchema = new mongoose.Schema({
  appointmentId: { 
    type: String, 
    required: true,
    unique: true 
  },
  paymentID: { 
    type: String,
  },
  paymentAmount: { type: Number },
  appointmentBlockChainId: { 
    type: String, 
    required: false,
  },
  patientId: { 
    type: String, 
    required: function() { return !this.isGuest; }, // Required only for non‑guest appointments
    ref: 'Patient'
  },
  patientName: {
    type: String,
    required: true
  },
  doctorId: { 
    type: String, 
    required: true,
    ref: 'Doctor'
  },
  doctorName: { 
    type: String, 
    required: true 
  },
  doctorSpecialization: {
    type: String,
    required: true
  },
  
  // Appointment Details
  date: { 
    type: Date, 
    required: true 
  },

  timeSlot: { 
    type: String, 
    required: true 
  }, // "10:00-10:15"

  slotDuration: { 
    type: Number, 
    default: 15 
  }, 
    
  // Appointment Purpose
  reason: { 
    type: String, 
    required: true 
  },

  symptoms: [String],

  // Status Tracking
  status: { 
    type: String, 
    enum: [
      'pending',
      'scheduled', 
      'confirmed', 
      'checked-in', 
      'in-consultation', 
      'completed', 
      'cancelled', 
      'no-show'
    ],
    default: 'scheduled'
  },

  paymentStatus:{ 
    type: String, 
    enum: [
      'waiting',
      'pending',
      'completed', 
      'cancelled'
    ],
    default: 'pending'
  },

  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    changedBy: String // 'patient', 'doctor', 'system'
  }],
  
  // Consultation Details (filled after appointment)
  consultation: {
    diagnosis: String,
    prescription: [{
      medicine: String,
      dosage: String,
      frequency: String,
      duration: String
    }],
    notes: String,
    followUpDate: Date,
    testsRecommended: [String],
    vitalSigns: {
      bloodPressure: String,
      heartRate: Number,
      temperature: Number,
      weight: Number,
      spo2: Number
    }
  },
  
  // Access Permissions
  accessPermissions: {
    granted: { type: Boolean, default: false },
    grantedAt: Date,
    expiresAt: Date,
    dataTypes: [String]
  },

  // Guest appointment fields
  isGuest: { 
    type: Boolean, 
    default: false 
  },
  guestDetails: {
    name: { type: String }, // Already stored in patientName, but kept for clarity
    age: { type: Number },
    email: { type: String },
    phone: { type: String }
  },
  
  // Timestamps
  bookedAt: { type: Date, default: Date.now },
  confirmedAt: Date,
  checkedInAt: Date,
  consultationStartAt: Date,
  consultationEndAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  
  // Blockchain Reference
  blockchainAppointmentId: { type: String },
  blockchainHash: { type: String }
});

// Indexes for efficient queries
appointmentSchema.index({ paymentID: 1 });
appointmentSchema.index({ patientId: 1, date: 1 });
appointmentSchema.index({ doctorId: 1, date: 1 });
appointmentSchema.index({ status: 1, date: 1 });
appointmentSchema.index({ patientId: 1, status: 1 });
appointmentSchema.index({ doctorId: 1, status: 1 });

module.exports = {
    Patient: mongoose.model('Patient', patientSchema),
    Doctor: mongoose.model('Doctor', doctorSchema),
    Appointment: mongoose.model('Appointment', appointmentSchema),
    Hospital: mongoose.model('Hospital',hospitalSchema)
};