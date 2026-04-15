require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { Patient, Doctor, Appointment,Hospital } = require('./Database');
const UserRegistrationClient = require('./UserRegistrations');
const FabricClient = require('./FabricClient');
const PaymentService = require('./paymentService');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const { deflateRawSync } = require('zlib');
const { CHANNEL_ARGS_CONFIG_SELECTOR_KEY } = require('@grpc/grpc-js/build/src/resolver.js');
const MongoWallet = require('./MongoWallet');
const wallet = new MongoWallet();

const app = express();
app.use(cors()); // This allows ALL origins and ALL methods by default

app.use(express.json());
console.log(process.env.MONGODB_ATLAS_URI);
const mongoURI = process.env.MONGODB_ATLAS_URI;

async function connectDB() {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Exit the process if DB connection fails
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected!');
});

connectDB();
// Create transporter once
const transporter = nodemailer.createTransport({
  pool: true,
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,           // STARTTLS – must be false for port 587
  family: 4,               // ← Force IPv4 (critical for Render)
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
  },
  tls: {
    rejectUnauthorized: false, // Keep for debugging only; remove in production after testing
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
});

// const resend = new Resend(process.env.RESEND_API_KEY);

// const sendEmail = async ({ to, subject, html, from = 'onboarding@resend.dev', cc = [] }) => {
//   if (!to || !subject || !html) {
//     throw new Error('Missing required email fields');
//   }

//   try {
//     const { data, error } = await resend.emails.send({
//       from: from,
//       to: to,
//       cc: cc,
//       subject: subject,
//       html: html,
//     });

//     if (error) {
//       throw new Error(error.message);
//     }
//     console.log(`Email sent to ${to}: ${data.id}`);
//     return data;
//   } catch (error) {
//     console.error(`Failed to send email:`, error);
//     throw error;
//   }
// };

async function checkUsernameExists(username) {
    try {
      const patient = await Patient.findOne({ username });
      const doctor = await Doctor.findOne({ username });
  
      if (patient) {
        return { exists: true, type: 'patient', data: patient };
      } else if (doctor) {
        return { exists: true, type: 'doctor', data: doctor };
      } else {
        return { exists: false, type: null, data: null };
      }
    } catch (error) {
      console.error('Error checking username:', error);
      throw error;
    }
}

async function checkPhonenoExists(phoneNo) {
  try {
    const patient = await Patient.findOne({ phoneNo:phoneNo });
    const doctor = await Doctor.findOne({ phoneNo:phoneNo });
    const hospital = await Doctor.findOne({ phoneNo:phoneNo })

    if (patient) {
      return { exists: true, type: 'patient', data: patient };
    } else if (doctor) {
      return { exists: true, type: 'doctor', data: doctor };
    }else if (hospital) {
      return { exists: true, type: 'hospital', data: hospital };
    } else {
      return { exists: false, type: null, data: null };
    }
  } catch (error) {
    console.error('Error checking username:', error);
    throw error;
  }
}

async function checkEmailExists(email) {
  try {
      const patient = await Patient.findOne({ email:email });
      if (patient) {
          return { exists: true, type: 'patient', user: patient };
      }

      const doctor = await Doctor.findOne({ email:email });
      if (doctor) {
          return { exists: true, type: 'doctor', user: doctor };
      }

      const hospital = await Doctor.findOne({ email:email });
      if (hospital) {
        return { exists: true, type: 'hospital', user: hospital };
      }

      return { exists: false, type: null, user: null };

  } catch (error) {
      console.error('Error checking email:', error);
      throw error;
  }
}


async function checkAadharExists(aadharCardNo) {
    try {
        const patient = await Patient.findOne({ aadharCardNo:aadharCardNo });
        return { exists: !!patient, patient };
    } catch (error) {
        console.error('Error checking Aadhar:', error);
        throw error;
    }
}

async function checkRegistrationNExists(registrationNumber) {
  try {
    const doctor = await Doctor.findOne({ registrationNumber:registrationNumber });
    return { exists: !!doctor, doctor };
  } catch (error) {
      console.error('Error checking Aadhar:', error);
      throw error;
  }
}

const sendEmail = async ({ to, subject, html, from = process.env.EMAIL_FROM, cc = [] }) => {
  if (!to || !subject || !html) {
    throw new Error('Missing required email fields: to, subject, html');
  }

  const mailOptions = {
    from,
    to,
    subject,
    html,
    cc,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Full error object:", error);
    console.error("Error code:", error.code);
    console.error("Response:", error.response);
    throw error;
  }
};
app.get('/check-username/:username', async (req, res) => {
  try {
      const { username } = req.params;
      console.log(username);
      if (!username) {
          return res.status(400).json({
              success: false,
              error: 'Username is required'
          });
      }

      const result = await checkUsernameExists(username);
      
      res.json({
          success: true,
          username: username,
          available: !result.exists
      });

  } catch (error) {
      console.error('❌ Check username error:', error.message);
      res.status(500).json({
          success: false,
          error: error.message
      });
  }
});

app.get('/check-aadhar/:aadhar', async (req, res) => {
  try {
      const { aadhar } = req.params;
      console.log(aadhar);
      if (!aadhar) {
          return res.status(400).json({
              success: false,
              error: 'Username is required'
          });
      }

      const result = await checkAadharExists(aadhar);
      
      res.json({
          success: true,
          aadhar: aadhar,
          available: !result.exists
      });

  } catch (error) {
      console.error('❌ Check username error:', error.message);
      res.status(500).json({
          success: false,
          error: error.message
      });
  }
});

app.get('/check-regisno/:regisno', async (req, res) => {
  try {
      const { regisno } = req.params;
      console.log(regisno);
      if (!regisno) {
          return res.status(400).json({
              success: false,
              error: 'Username is required'
          });
      }

      const result = await checkRegistrationNExists(regisno);
      
      res.json({
          success: true,
          regisno: regisno,
          available: !result.exists
      });

  } catch (error) {
      console.error('❌ Check username error:', error.message);
      res.status(500).json({
          success: false,
          error: error.message
      });
  }
});

app.get('/check-phoneno/:phoneno', async (req, res) => {
  try {
      const { phoneno } = req.params;
      console.log(phoneno);
      if (!phoneno) {
          return res.status(400).json({
              success: false,
              error: 'Username is required'
          });
      }

      const result = await checkPhonenoExists(phoneno);
      
      res.json({
          success: true,
          phoneno: phoneno,
          available: !result.exists
      });

  } catch (error) {
      console.error('❌ Check username error:', error.message);
      res.status(500).json({
          success: false,
          error: error.message
      });
  }
});

app.get('/check-email/:email', async (req, res) => {
  try {
      const { email } = req.params;
      console.log(email);
      if (!email) {
          return res.status(400).json({
              success: false,
              error: 'Username is required'
          });
      }

      const result = await checkEmailExists(email);
      
      res.json({
          success: true,
          email: email,
          available: !result.exists
      });

  } catch (error) {
      console.error('❌ Check username error:', error.message);
      res.status(500).json({
          success: false,
          error: error.message
      });
  }
});

app.get('/check-hospital-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const hospital = await Hospital.findOne({ email });
    res.json({ exists: !!hospital });
  } catch (error) {
    res.status(500).json({ exists: false, error: error.message });
  }
});

app.post('/register-patient', async (req, res) => {
  console.log('\nPATIENT REGISTRATION REQUEST');
  console.log(req.body);
  try {
    const { username, name, email, phoneNo, aadharCardNo, password } = req.body;

    // --- Input validation (as before) ---
    if (!username || !name || !email || !phoneNo || !aadharCardNo || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    if (phoneNo.length < 10) {
      return res.status(400).json({ success: false, error: 'Phone number must be at least 10 digits' });
    }
    const aadharRegex = /^\d{12}$/;
    if (!aadharRegex.test(aadharCardNo)) {
      return res.status(400).json({ success: false, error: 'Aadhar card number must be 12 digits' });
    }

    // --- Uniqueness checks ---
    const usernameCheck = await checkUsernameExists(username);
    if (usernameCheck.exists) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    const emailCheck = await checkEmailExists(email);
    if (emailCheck.exists) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }
    const aadharCheck = await checkAadharExists(aadharCardNo);
    if (aadharCheck.exists) {
      return res.status(400).json({ success: false, error: 'Aadhar card number already registered' });
    }

    // --- Save patient to MongoDB ---
    console.log('💾 Saving patient data in MongoDB...');
    const patient = new Patient({
      username,
      name,
      email,
      phoneNo,
      aadharCardNo,
      password,
      blockchainStatus: 'pending',
    });
    await patient.save();
    console.log('✅ MongoDB save successful');

    // --- Send immediate success response ---
    res.status(201).json({
      success: true,
      message: 'Patient registered successfully. Blockchain registration is being processed. You will receive an email shortly.',
      patient: {
        username,
        name,
        email,
        phoneNo,
        aadharCardNo
      }
    });

    // --- Background tasks (non‑blocking) ---
    setImmediate(async () => {
      try {
        const client = new UserRegistrationClient('PatientOrg', wallet);
        await client.initialize();
        await client.ensureAdmin();
        await client.registerAndEnrollUser(username, 'patient',  name);

        await client.registerAndEnrollUser(username, 'patient', name);
        console.log(`✅ CA registration complete for ${username}`);

        const fb = new FabricClient('./full-connection.json', wallet, username);
        await fb.initialize();
        const blockchainResult = await fb.registerPatient(patient._id.toString(), name, username);
        const returnedId = blockchainResult.toString();
        console.log(`Patient registered with ID: ${returnedId}`);

        patient.blockchainPatientId = patient._id;
        patient.blockchainStatus = 'completed';
        await patient.save();
        console.log(`✅ Blockchain registration complete for ${username}`);

        await sendEmail({
          to: email,
          subject: 'Registration Successful',
          html: `<p>Dear ${name}, and ID ${returnedId} your patient registration is complete!</p>
                 <p>You can now login and use our services.</p>`
        });
      } catch (error) {
        console.error(`❌ Background blockchain registration failed for ${username}:`, error.message);
        // Update patient status to failed
        patient.blockchainStatus = 'failed';
        patient.blockchainError = error.message;
        await patient.save();
        // Optionally send failure email
        await sendEmail({
          to: email,
          subject: 'Registration Issue',
          html: `<p>Dear ${name}, there was a problem completing your registration. Please contact support.</p>`
        });
      }
    });

  } catch (error) {
    // Cleanup in case of early error (before response sent)
    if (error.message.includes('MongoDB') && req.body.username) {
      try {
        console.log('🧹 Cleaned up wallet entry due to MongoDB failure');
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError.message);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
app.post('/register-hospital', async (req, res) => {
    console.log('\nHOSPITAL REGISTRATION REQUEST');

    try {
        const { name, email, password, phoneNo, address={},tier } = req.body;
        let mspid='HealthcareProviderOrgMSP'
        let walletpath=path.join(__dirname, 'wallet', 'ProviderOrg');
        let collectionname='appointmentDefault';
        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: hospital_id, name, email, password'
            });
        }

        // Hash password
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long'
            });
        }
        if(tier==='3'){
          mspid = `${name}MSP`.toLowerCase();
          collectionname=`appointment${name}`
          walletpath = path.join(__dirname, 'wallet', name);
        }
         
        const hospital = new Hospital({
            name,
            email: email,
            password: password,
            mspId:mspid,
            walletpath,
            phoneNo: phoneNo || undefined,
            address: address || {},
            isVerified: true,
            tier:tier,
            collectionname:collectionname,
            blockchainStatus:'pending'
        });

        await hospital.save();

        res.status(201).json({
            success: true,
            message: 'Hospital registered successfully. email will be sent before login is working.',
            hospital: {
                hospital_id: hospital._id,
                mspId: hospital.mspId,
                email: hospital.email,
                walletpath: hospital.walletpath,
                tier:hospital.tier,
                collectionname:collectionname,
                blockchainStatus:hospital.blockchainStatus
            }
        });
        setImmediate(async()=>{
            console.time("hp");
            const client = new UserRegistrationClient(hospital.name, wallet);
            await client.initialize();
            await client.ensureAdmin();
            await client.registerAndEnrollUser(hospital.email, 'hospital', hospital.name);
            const fb = new FabricClient(
              './full-connection.json',
              wallet,
              hospital.email
            );
            await fb.initialize();
            await fb.registerHospital(
              hospital._id.toString(),
              hospital.name,
              hospital.collectionname,
              hospital.name
            );
            console.timeEnd("hp");
            const client2 = new UserRegistrationClient('PlatformOrg', wallet);
            await client2.initialize();
            await client2.ensureAdmin();
            await client2.registerAndEnrollUser('ck', 'client', 'prachi');
            const fb2 = new FabricClient(
              './full-connection.json',
              wallet,
              'ck'
            );
            await fb2.initialize();
            console.time("Register");
            await fb2.SetCollection(
              hospital.mspId,
              collectionname
            );
            console.timeEnd("Register");
            await sendEmail({
              to: email,
              subject: 'Registration Successful',
              html: `<p>Dear ${name} hospital, and ID ${hospital._id.toString()} your request is submitted</p>
                     <p>We will send you mail upon register complition.</p>`
            });
        })
        
    } catch (error) {
        console.error('Error in hospital registration:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

app.post('/register-blockchain-hospital', async (req, res) => {
  try{
    const {hid}=req.body;
    console.time("hp");
    console.log("lova");
    const hospital= await Hospital.findById(hid);
    console.log(hospital);
    const client = new UserRegistrationClient(hospital.name, wallet);
    await client.initialize();
    await client.ensureAdmin();
    await client.registerAndEnrollUser(hospital.email, 'hospital', hospital.name);
    console.log("lovda");
    const fb = new FabricClient(
      './full-connection.json',
      wallet,
      hospital.email
    );
    await fb.initialize();
    console.log('f');
    await fb.registerHospital(
      hid,
      hospital.name,
      hospital.collectionname,
      hospital.name
    );
    console.timeEnd("hp");
    res.status(201).json({success: true});

  }catch(error){
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
})
app.post('/register-doctor', async (req, res) => {
    console.log('\nDOCTOR REGISTRATION REQUEST');
    console.log(req.body);
    try {
        const { username, name, email, phoneNo, registrationNumber, password, hospitalemail = '' } = req.body;

        // --- Input validation ---
        if (!username || !name || !email || !phoneNo || !registrationNumber || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: username, name, email, phoneNo, registrationNumber, password'
            });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }
        if (phoneNo.length < 10) {
            return res.status(400).json({ success: false, error: 'Phone number must be at least 10 digits' });
        }

        // --- Uniqueness checks (implement these helper functions) ---
        const usernameCheck = await checkUsernameExists(username);
        if (usernameCheck.exists) {
            return res.status(400).json({ success: false, error: 'Username already exists' });
        }
        const emailCheck = await checkEmailExists(email);
        if (emailCheck.exists) {
            return res.status(400).json({ success: false, error: 'Email already exists' });
        }
        const regCheck = await checkRegistrationNExists(registrationNumber);
        if (regCheck.exists) {
            return res.status(400).json({ success: false, error: 'Registration number already exists' });
        }

        // --- Determine organization and wallet based on hospital affiliation ---
        let orgName = 'ProviderOrg';               // default organization name
        let mspId = 'HealthcareProviderOrgMSP';    // default MSP ID
        let walletPath = path.join(__dirname, 'wallet', 'ProviderOrg');
        let collectionName = 'appointmentDefault'; // default collection
        let hospitalIdRef = '';
        let hospital = null;
        if (hospitalemail!='') {
          hospital = await Hospital.findOne({email:hospitalemail});
          if (!hospital) {
              return res.status(404).json({ success: false, error: 'Hospital not found' });
          }
          // After successfully creating the doctor and linking to hospital
          await Hospital.findOneAndUpdate(
            { email: hospitalemail },
            { $inc: { 'stats.totalDoctors': 1 } }
          );
          
          hospitalIdRef = hospital._id.toString();
          orgName = hospital.name;          // e.g., 'citygeneral'
          mspId = hospital.mspId;                  // e.g., 'citygeneralMSP'
          walletPath = hospital.walletpath;        // e.g., ./wallet/citygeneral
          collectionName = `appointment${hospital.name}`; // consistent naming
        }
        console.log(hospitalIdRef,collectionName,mspId,walletPath);

        const doctor = new Doctor({
            username,
            name,
            email,
            phoneNo,
            registrationNumber,
            password: password,
            hospital_id: hospitalIdRef,
            hospital_name:hospitalIdRef!=''?orgName:'',
            collectionname:collectionName,
            walletpath:walletPath,
            mspId,
            blockchainStatus: 'pending'   // track blockchain registration
        });
        await doctor.save();
        console.log('✅ MongoDB save successful');
        if(hospital!=null){
          hospital.doctorReferences.push({
            doctorId: doctor._id.toString(),
            name: doctor.name
          });
          await hospital.save();
        }
        
        // --- Send immediate response (without waiting for blockchain) ---
        res.status(201).json({
            success: true,
            message: 'Doctor registered successfully. Blockchain registration is being processed.',
            doctor: {
              username,
              name,
              email,
              phoneNo,
            }
        });

        // --- Background blockchain registration (non‑blocking) ---
        setImmediate(async () => {
            try {
                // 1. Register with Fabric CA (as a doctor)
                const client = new UserRegistrationClient(orgName, wallet);
                await client.initialize();
                await client.ensureAdmin();

                // Register the doctor identity in the CA (type: doctor)
                await client.registerAndEnrollUser(username, 'doctor', name);
                console.log(`✅ CA registration complete for ${username}`);

                // 2. Invoke chaincode to register doctor on the ledger
                const fb = new FabricClient(
                    './full-connection.json',
                    wallet,
                    username
                );
                await fb.initialize();
                console.time("Register");
                const blockchainResult = await fb.registerDoctor(
                  doctor._id.toString(),
                  name,
                  username,
                  hospitalIdRef || '',
                  orgName
                );
                console.timeEnd("Register");
                const returnedId = blockchainResult.toString();
                console.log(`Doctor registered with ID: ${returnedId}`);

                doctor.blockchainStatus = 'completed';
                await doctor.save();
                console.log(`✅ Blockchain registration complete for ${username}`);

                // 4. Send success email
                await sendEmail({
                    to: email,
                    subject: 'Registration Successful',
                    html: `<p>Dear ${name} and ID ${returnedId}, your doctor registration is complete!</p>
                           <p>You can now login and use our services.</p>`
                });
            } catch (error) {
                console.error(`❌ Background blockchain registration failed for ${username}:`, error.message);
                // Update doctor record to failed status
                doctor.blockchainStatus = 'failed';
                doctor.blockchainError = error.message;
                await doctor.save();

                // Optionally send failure email
                await sendEmail({
                    to: email,
                    subject: 'Registration Issue',
                    html: `<p>Dear ${name}, there was a problem completing your registration. Please contact support.</p>`
                });
            }
        });
    } catch (error) {
        console.error('Doctor registration error:', error);
        // Attempt to clean up wallet if MongoDB fails early (optional)
        if (error.message.includes('MongoDB') && req.body.username) {
            try {
                const org = req.body.hospitalID ? req.body.hospitalID : 'ProviderOrg';
                const wallet = await Wallets.newFileSystemWallet(path.join(__dirname, 'wallet', org));
                await wallet.remove(req.body.username);
                console.log('🧹 Cleaned up wallet entry due to MongoDB failure');
            } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError.message);
            }
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/set-collection', async (req, res) => {
  try {
    const{msp,collectionName}=req.body;
    const client = new UserRegistrationClient('PlatformOrg', wallet);
    await client.initialize();
    await client.ensureAdmin();
    await client.registerAndEnrollUser('work', 'client', 'prachi');
    const fb = new FabricClient(
      './full-connection.json',
      wallet,
      'work'
    );
    await fb.initialize();
    console.time("Register");
    await fb.SetCollection(
      msp,
      collectionName
    );
    console.timeEnd("Register");
    res.status(201).json({success: true});
  }catch(error){
    res.status(500).json({ success: false, error: error.message });
  }
})
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate email format (if provided)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }

    // Search for user across collections
    let user = null;
    let userType = null; // 'patient', 'doctor', or 'hospital'

    // Check Patient collection
    user = await Patient.findOne({ email }).select('+password');
    if (user) {
      userType = 'patient';
    } else {
      // Check Doctor collection
      user = await Doctor.findOne({ email }).select('+password');
      if (user) {
        userType = 'doctor';
      } else {
        // Check Hospital collection
        user = await Hospital.findOne({ email }).select('+password');
        if (user) {
          userType = 'hospital';
        }
      }
    }

    // If no user found
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Verify password (plaintext comparison – consider hashing in production)
    const isPasswordValid = password === user.password;
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Handle each user type with specific logic
    if (userType === 'patient') {
      const patientClient = new UserRegistrationClient('PatientOrg',wallet);
      await patientClient.initialize();
      const exists = await patientClient.userExists(user.username);
      if (!exists) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Patient role required.'
        });
      }

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          id: user._id,
          userType: 'patient',
          email: user.email,
          fullName: user.fullName,
          completed: user.profileCompleted,
          username: user.username
        }
      });
    }

    if (userType === 'doctor') {
      let hospital = null;
      let doctorClient;

      if (user.hospital_id) {
        hospital = await Hospital.findById(new mongoose.Types.ObjectId(user.hospital_id));
        doctorClient = new UserRegistrationClient(hospital.name, wallet);
      } else {
        doctorClient = new UserRegistrationClient('ProviderOrg', wallet);
      }

      await doctorClient.initialize();
      const exists = await doctorClient.userExists(user.username);
      if (!exists) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Doctor role required.'
        });
      }

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          id: user._id,
          userType: 'doctor',
          email: user.email,
          fullName: `${user.name}`,
          completed: user.profileCompleted,
          username: user.username,
          specialization: user.specialization,
          hospitalid: user.hospital_id || '',
          hospitalname: hospital ? hospital.name : '',
          walletpath: user.walletpath,
          collectionname: user.collectionname
        }
      });
    }

    if (userType === 'hospital') {
      const hospitalClient = new UserRegistrationClient(user.name, wallet);
      await hospitalClient.initialize();
      const exists = await hospitalClient.userExists(user.email);
      if (!exists) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Hospital role required.'
        });
      }

      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          id: user._id,
          userType: 'hospital',
          email: user.email,
          collectionname: user.collectionname,
          name: user.name,
          walletpath: user.walletpath
        }
      });
    }

    // Fallback (should never reach here if userType was set)
    return res.status(500).json({
      success: false,
      message: 'Unexpected error: user type not determined'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});
app.post('/fill-doc-info',async(req,res)=>{
    try {
        const{username}=req.body;
        if (!username) {
          return res.status(400).json({
              success: false,
              message: 'Username is required'
          });
        }
        const user = await Doctor.findOne({ username }).select('+password');
        if(!user){
          return res.status(403).json({ 
            success: false, 
            message: 'User not found.' 
          });
        }
        let doctor=null;
        console.log(user)
        if (user.hospital_id!=''){
          doctor = new UserRegistrationClient(user.hospital_name, wallet);
        }else{
          doctor = new UserRegistrationClient('ProviderOrg', wallet);
        }
        await doctor.initialize();
        const exist = await doctor.userExists(user.username);    
        if (!exist) {
          return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Doctor role required.' 
          });
        }

        const {
          specialization,
          subSpecialization,
          qualifications,
          totalExperience,
          bio,
          languages,
          dateOfBirth,
          gender,
          address,
          consultationFee
        } = req.body;
    
        if (!specialization) {
          return res.status(400).json({
            success: false,
            message: 'Specialization is required'
          });
        }
    
        const validSpecializations = [
          'Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology', 
          'General Physician', 'Gynecology', 'Neurology', 'Oncology', 
          'Orthopedics', 'Pediatrics', 'Psychiatry', 'Radiology', 'Urology',
          'Dentistry', 'ENT', 'Ophthalmology', 'Physiotherapy'
        ];
    
        if (!validSpecializations.includes(specialization)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid specialization'
          });
        }
    
        // Validate gender enum
        const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
        if (gender && !validGenders.includes(gender)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid gender value'
          });
        }
    
        // Update doctor information
        const updatedDoctor = await Doctor.findOneAndUpdate(
          { username },
          {
            $set: {
              specialization,
              subSpecialization: subSpecialization || [],
              qualifications: qualifications || [],
              totalExperience: totalExperience || 0,
              bio: bio || '',
              languages: languages || [],
              consultationFee:parseInt(consultationFee)||100,
              dateOfBirth: dateOfBirth || null,
              gender: gender || 'Prefer not to say',
              address: address || {},
              profileCompleted: true 
            }
          },
          { 
            new: true, 
            runValidators: true,
            select: '-password' 
          }
        );
    
        if (!updatedDoctor) {
          return res.status(404).json({
            success: false,
            message: 'Doctor not found'
          });
        }
    
        res.json({
          success: true,
          message: 'Personal information updated successfully',
          data: updatedDoctor
        });
      
    } catch (error) {
      console.error('Error updating doctor personal info:', error);
      
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors
        });
      }
  
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }
);


app.get('/doctors', async (req, res) => {
  try {
    const { 
      specialization,
      hospitalname,
      city, 
      state, 
      pincode, 
      search, // General search across name, specialization, city
      minExperience,
      maxExperience,
      language,
      limit = 20, 
      page = 1 
    } = req.query;

    // Build query
    let query = { profileCompleted: true };
    
    // Specialization filter
    if (specialization) {
      query.specialization = specialization;
    }

    if(hospitalname){
      query.hospital_name = hospitalname;
    }

    // Location-based filters - FIXED
    const locationFilters = {};
    if (city) {
      locationFilters['address.city'] = { $regex: new RegExp(city, 'i') };
    }
    if (state) {
      locationFilters['address.state'] = { $regex: new RegExp(state, 'i') };
    }
    if (pincode) {
      locationFilters['address.pincode'] = pincode;
    }

    // Only add address to query if there are location filters
    if (Object.keys(locationFilters).length > 0) {
      query = { ...query, ...locationFilters };
    }

    // Experience range filter
    if (minExperience || maxExperience) {
      query.totalExperience = {};
      if (minExperience) {
        query.totalExperience.$gte = parseInt(minExperience);
      }
      if (maxExperience) {
        query.totalExperience.$lte = parseInt(maxExperience);
      }
    }

    // Language filter
    if (language) {
      query.languages = { $in: [new RegExp(language, 'i')] };
    }

    // General search across multiple fields
    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { specialization: { $regex: new RegExp(search, 'i') } },
        { 'address.city': { $regex: new RegExp(search, 'i') } },
        { bio: { $regex: new RegExp(search, 'i') } }
      ];
    }

    console.log('Final Query:', JSON.stringify(query, null, 2)); // Debug log

    // Get doctors with pagination
    const doctors = await Doctor.find(query)
      .select('username name phoneNo email registrationNumber address specialization subSpecialization qualifications totalExperience bio profilePhoto languages isVerified ratings stats averageConsultationTime hospital_id hospital_name')
      .sort({ 
        totalExperience: -1, 
        'ratings.average': -1, 
        name: 1 
      })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get total count for pagination
    const totalDoctors = await Doctor.countDocuments(query);

    // Format response
    const formattedDoctors = doctors.map(doctor => ({
      id: doctor._id,
      username: doctor.username,
      name: doctor.name,
      phoneNo: doctor.phoneNo,
      email: doctor.email,
      hospital_id:doctor.hospital_id,
      hospital_name:doctor.hospital_name,
      registrationNumber: doctor.registrationNumber,
      address: doctor.address,
      specialization: doctor.specialization,
      subSpecialization: doctor.subSpecialization,
      qualifications: doctor.qualifications,
      totalExperience: doctor.totalExperience,
      bio: doctor.bio,
      profilePhoto: doctor.profilePhoto,
      languages: doctor.languages,
      isVerified: doctor.isVerified,
      ratings: doctor.ratings || { average: 0, totalReviews: 0 },
      stats: doctor.stats || { averageRating: 0, reviewCount: 0 },
      averageConsultationTime: doctor.averageConsultationTime || 15
    }));

    res.json({
      success: true,
      data: {
        doctors: formattedDoctors,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalDoctors,
          pages: Math.ceil(totalDoctors / parseInt(limit))
        },
        filters: {
          specialization: specialization || 'all',
          city: city || 'all',
          state: state || 'all',
          pincode: pincode || 'all',
          search: search || '',
          minExperience: minExperience || '',
          maxExperience: maxExperience || '',
          language: language || ''
        }
      }
    });

  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET /hospitals
app.get('/hospitals', async (req, res) => {
  try {
    const {
      name,                 // Hospital name (partial match, case-insensitive)
      email,                // Hospital email (partial match, case-insensitive)
      city,
      state,
      pincode,
      search,               // General search across name, email, city, state
      tier,                 // Filter by hospital tier (if needed)
      isVerified,           // Filter by verification status (true/false)
      limit = 20,
      page = 1
    } = req.query;

    // Build query object
    let query = {};

    // Name filter
    if (name) {
      query.name = { $regex: new RegExp(name, 'i') };
    }

    // Email filter
    if (email) {
      query.email = { $regex: new RegExp(email, 'i') };
    }

    // Location-based filters (address subdocument)
    const locationFilters = {};
    if (city) {
      locationFilters['address.city'] = { $regex: new RegExp(city, 'i') };
    }
    if (state) {
      locationFilters['address.state'] = { $regex: new RegExp(state, 'i') };
    }
    if (pincode) {
      locationFilters['address.pincode'] = pincode; // exact match (or regex if needed)
    }

    if (Object.keys(locationFilters).length > 0) {
      query = { ...query, ...locationFilters };
    }

    // Tier filter
    if (tier) {
      query.tier = tier;
    }

    // Verification status
    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true';
    }

    // General search across multiple fields
    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { email: { $regex: new RegExp(search, 'i') } },
        { 'address.city': { $regex: new RegExp(search, 'i') } },
        { 'address.state': { $regex: new RegExp(search, 'i') } }
      ];
    }

    console.log('Hospital Search Query:', JSON.stringify(query, null, 2));

    // Fetch hospitals with pagination
    const hospitals = await Hospital.find(query)
      .select('name email phoneNo address profilePhoto tier isVerified stats createdAt')
      .sort({ name: 1, createdAt: -1 }) // sort by name ascending, then newest first
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Get total count for pagination
    const totalHospitals = await Hospital.countDocuments(query);

    // Format response
    const formattedHospitals = hospitals.map(hospital => ({
      id: hospital._id,
      name: hospital.name,
      email: hospital.email,
      phoneNo: hospital.phoneNo,
      address: hospital.address,
      profilePhoto: hospital.profilePhoto,
      tier: hospital.tier,
      isVerified: hospital.isVerified,
      stats: hospital.stats,
      createdAt: hospital.createdAt
    }));

    res.json({
      success: true,
      data: {
        hospitals: formattedHospitals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalHospitals,
          pages: Math.ceil(totalHospitals / parseInt(limit))
        },
        filters: {
          name: name || '',
          email: email || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
          search: search || '',
          tier: tier || '',
          isVerified: isVerified || ''
        }
      }
    });

  } catch (error) {
    console.error('Error fetching hospitals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.get('/doctors/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const doctor = await Doctor.findOne({ 
      username,
    }).select('-password -appointmentReferences -blockedSlots -scheduleOverrides');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or profile not completed'
      });
    }

    // Get doctor's availability for the next 7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingAvailability = await getDoctorUpcomingAvailability(doctor._id, new Date(), nextWeek);

    const doctorData = {
      id:doctor._id,
      username: doctor.username,
      name: doctor.name,
      phoneNo: doctor.phoneNo,
      email: doctor.email,
      hospital_id: doctor.hospital_id,
      hospital_name: doctor.hospital_name,
      registrationNumber: doctor.registrationNumber,
      consultationFee: doctor.consultationFee, 
      address: doctor.address,
      specialization: doctor.specialization,
      subSpecialization: doctor.subSpecialization,
      qualifications: doctor.qualifications,
      totalExperience: doctor.totalExperience,
      bio: doctor.bio,
      profilePhoto: doctor.profilePhoto,
      languages: doctor.languages,
      dateOfBirth: doctor.dateOfBirth,
      gender: doctor.gender,
      isVerified: doctor.isVerified,
      verificationStatus: doctor.verificationStatus,
      stats: doctor.stats,
      averageConsultationTime: doctor.averageConsultationTime,
      emergencyAvailability: doctor.emergencyAvailability,
      // Availability information
      upcomingAvailability: upcomingAvailability.availableDates,
      weeklySchedule: doctor.weeklySchedule,
      profileCompleted: doctor.profileCompleted,
      // Ratings and reviews summary
      ratings: {
        average: doctor.stats.averageRating,
        totalReviews: doctor.stats.reviewCount
      }
    };

    res.json({
      success: true,
      data: doctorData
    });

  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET /hospitals/:email
app.get('/hospitals/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const hospital = await Hospital.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    }).select('-password -appointmentReferences -blockchainStatus');

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Limit doctorReferences to first 5
    const limitedDoctorReferences = (hospital.doctorReferences || []).slice(0, 5);

    const hospitalData = {
      id: hospital._id,
      email: hospital.email,
      name: hospital.name,
      mspId: hospital.mspId,
      collectionname: hospital.collectionname,
      tier: hospital.tier,
      phoneNo: hospital.phoneNo,
      address: hospital.address,
      profilePhoto: hospital.profilePhoto,
      isVerified: hospital.isVerified,
      walletpath: hospital.walletpath,
      stats: hospital.stats || { totalDoctors: 0, totalAppointments: 0, totalConsultations: 0 },
      doctorReferences: limitedDoctorReferences, // first 5 only
      createdAt: hospital.createdAt,
      updatedAt: hospital.updatedAt
    };

    res.json({
      success: true,
      data: hospitalData
    });

  } catch (error) {
    console.error('Error fetching hospital:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET /hospitals/:email/doctors
app.get('/hospitals/:email/doctors', async (req, res) => {
  try {
    const { email } = req.params;
    const {
      specialization,     // filter by specialization
      search,             // general search across name, specialization, city
      minExperience,
      maxExperience,
      language,
      limit = 20,
      page = 1
    } = req.query;

    // Find hospital by email
    const hospital = await Hospital.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Build query for doctors belonging to this hospital
    let query = {
      hospital_id: hospital._id.toString(),   // assuming doctor.hospital_id stores hospital's mspId
      profileCompleted: true
    };

    // Specialization filter
    if (specialization) {
      query.specialization = specialization;
    }

    // Experience range filter
    if (minExperience || maxExperience) {
      query.totalExperience = {};
      if (minExperience) query.totalExperience.$gte = parseInt(minExperience);
      if (maxExperience) query.totalExperience.$lte = parseInt(maxExperience);
    }

    // Language filter
    if (language) {
      query.languages = { $in: [new RegExp(language, 'i')] };
    }

    // General search across name, specialization, city, bio
    if (search) {
      query.$or = [
        { name: { $regex: new RegExp(search, 'i') } },
        { specialization: { $regex: new RegExp(search, 'i') } },
        { 'address.city': { $regex: new RegExp(search, 'i') } },
        { bio: { $regex: new RegExp(search, 'i') } }
      ];
    }

    // Pagination & sorting
    const doctors = await Doctor.find(query)
      .select('username name phoneNo email registrationNumber address specialization subSpecialization qualifications totalExperience bio profilePhoto languages isVerified stats averageConsultationTime')
      .sort({ totalExperience: -1, 'stats.averageRating': -1, name: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalDoctors = await Doctor.countDocuments(query);

    // Format response
    const formattedDoctors = doctors.map(doc => ({
      id: doc._id,
      username: doc.username,
      name: doc.name,
      phoneNo: doc.phoneNo,
      email: doc.email,
      registrationNumber: doc.registrationNumber,
      address: doc.address,
      specialization: doc.specialization,
      subSpecialization: doc.subSpecialization,
      qualifications: doc.qualifications,
      totalExperience: doc.totalExperience,
      bio: doc.bio,
      profilePhoto: doc.profilePhoto,
      languages: doc.languages,
      isVerified: doc.isVerified,
      stats: doc.stats || { averageRating: 0, reviewCount: 0, totalConsultations: 0 },
      averageConsultationTime: doc.averageConsultationTime
    }));

    res.json({
      success: true,
      data: {
        doctors: formattedDoctors,
        hospital: {
          email: hospital.email,
          name: hospital.name,
          mspId: hospital.mspId
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalDoctors,
          pages: Math.ceil(totalDoctors / parseInt(limit))
        },
        filters: {
          specialization: specialization || 'all',
          search: search || '',
          minExperience: minExperience || '',
          maxExperience: maxExperience || '',
          language: language || ''
        }
      }
    });

  } catch (error) {
    console.error('Error fetching doctors for hospital:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.get('/doctors/:username/appointments/upcoming', async (req, res) => {
  try {
    const { username } = req.params;
    const { 
      status, 
      date, 
      patientName,
      limit = 20, 
      page = 1,
      includePast = false
    } = req.query;

    const doctor = await Doctor.findOne({ username: username });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Build query for appointments
    let query = { 
      doctorId: doctor._id.toString()
    };

    // Handle date filtering
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    } else if (!(includePast === 'true' || includePast === true)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.date = { $gte: today };
    }

    // Handle status filtering
    if (status && status !== 'all') {
      query.status = status;
    } else {
      if (date) {
        query.status = { $in: ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'] };
      } else if (includePast === 'true' || includePast === true) {
        query.status = { $in: ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'] };
      } else {
        query.status = { $in: ['scheduled', 'confirmed', 'checked-in', 'in-consultation','completed'] };
      }
    }

    // Handle patient name filter (search both registered and guest)
    if (patientName) {
      const matchingPatients = await Patient.find({
        name: { $regex: new RegExp(patientName, 'i') }
      }).select('_id');
      const patientIds = matchingPatients.map(p => p._id);
      const patientNameRegex = new RegExp(patientName, 'i');
      query.$or = [
        { patientId: { $in: patientIds } },
        { isGuest: true, patientName: { $regex: patientNameRegex } }
      ];
    }

    // Get total count (before pagination)
    const totalAppointments = await Appointment.countDocuments(query);

    // Fetch appointments with pagination
    const appointments = await Appointment.find(query)
      .populate('patientId', 'patientId username name email phoneNo dateOfBirth gender bloodGroup address')
      .sort({ date: 1, timeSlot: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // ------------------- NEW EARNINGS CALCULATION -------------------
    // Sum paymentAmount for all completed appointments of this doctor
    const earningsResult = await Appointment.aggregate([
      {
        $match: {
          doctorId: doctor._id.toString(),
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$paymentAmount', 0] } }
        }
      }
    ]);
    const totalEarnings = earningsResult.length > 0 ? earningsResult[0].total : 0;
    // ---------------------------------------------------------------

    // Format appointments
    const formattedAppointments = appointments.map(appointment => {
      if (appointment.isGuest) {
        return {
          appointmentId: appointment._id,
          appointmentNumber: appointment.appointmentId,
          date: appointment.date,
          timeSlot: appointment.timeSlot,
          status: appointment.status,
          paymentStatus:appointment.paymentStatus,
          reason: appointment.reason,
          notes: appointment.notes,
          patient: {
            name: appointment.patientName,
            phoneNo: appointment.guestDetails?.phone || 'N/A',
            email: appointment.guestDetails?.email || 'N/A',
            age: appointment.guestDetails?.age || null
          },
          isGuest: true,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt
        };
      } else {
        const patient = appointment.patientId;
        return {
          appointmentId: appointment._id,
          appointmentNumber: appointment.appointmentId,
          date: appointment.date,
          timeSlot: appointment.timeSlot,
          status: appointment.status,
          paymentStatus:appointment.paymentStatus,
          reason: appointment.reason,
          notes: appointment.notes,
          patient: patient ? {
            patientId: patient.patientId,
            username: patient.username,
            name: patient.name,
            email: patient.email,
            phoneNo: patient.phoneNo,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
            bloodGroup: patient.bloodGroup,
            address: patient.address,
            age: patient.dateOfBirth ? 
              new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : null
          } : null,
          isGuest: false,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt
        };
      }
    });

    res.json({
      success: true,
      data: {
        appointments: formattedAppointments,
        doctor: {
          username: doctor.username,
          name: doctor.name,
          specialization: doctor.specialization
        },
        statistics: {
          totalUpcoming: totalAppointments,
          totalEarnings: totalEarnings,
          byStatus: {}
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalAppointments,
          pages: Math.ceil(totalAppointments / parseInt(limit))
        },
        filters: {
          status: status || (includePast || date ? 'all' : 'active'),
          date: date || 'all',
          patientName: patientName || '',
          includePast: includePast === 'true'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointments',
      error: error.message
    });
  }
});

// Express route
app.get('/doctors/:username/appointment-test/upcoming', async (req, res) => {
  try {
    const { username } = req.params;
    const {
      status,
      date,
      patientName,
      limit = 20,
      includePast = false,
      bookmark: prevBookmark = '' 
    } = req.query;

    // Step 1: Get the doctor's ID from the username
    const doctor = await Doctor.findOne({ username });
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    const doctorId = doctor._id.toString(); // or doctor._id if that's the ID used in chaincode

    // Step 2: Determine filter parameters
    let startDate = '';
    let endDate = '';
    if (date) {
      startDate = date;
      endDate = date;
    } else if (!(includePast === 'true' || includePast === true)) {
      const today = new Date().toISOString().split('T')[0];
      startDate = today;
    }

    let statusFilter = '';
    if (status && status !== 'all') {
      statusFilter = status;
    } else if (!date && includePast !== 'true' && !status) {
      statusFilter = '';
    }

    // Step 3: Connect to the network and invoke chaincode
    const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';
    
    try {

      // 2. Invoke chaincode to register doctor on the ledger
      const fb = new FabricClient(
          './full-connection.json',
          wallet,
          username
      );
      await fb.initialize();
      console.time("Register");
      console.log(doctorId);
      const blockchainResult = await fb.getDoctorAppointments(
        doctorId,
        statusFilter,
        startDate,
        endDate,
        parseInt(limit),
        prevBookmark,
        patientName,
        doctor.hospital_name
      );
      console.log(blockchainResult);
  
      // blockchainResult already contains { records, nextBookmark }
      const appointments = blockchainResult.appointments;
      const nextBookmark = blockchainResult.bookmark || null;
  
      const formattedAppointments = appointments.map(app => ({
        appointmentId: app.appointmentId,
        appointmentNumber: app.appointmentId,
        date: app.date,
        timeSlot: app.timeSlot,
        status: app.status,
        reason: app.reason,
        notes: app.notes,
        patient: {
          patientId: app.patientId,
          name: app.patientName,
        },
        createdAt: app.bookedAt,
        updatedAt: app.bookedAt
      }));
  
      const hasMore = !!nextBookmark;
      const total = appointments.length; // this is the count of this page, not total overall
  
      res.json({
        success: true,
        data: {
          appointments: formattedAppointments,
          doctor: {
            username: doctor.username,
            name: doctor.displayName,
            specialization: doctor.specialization
          },
          statistics: {
            totalUpcoming: total
          },
          pagination: {
            limit: parseInt(limit),
            hasMore,
            nextBookmark
          },
          filters: {
            status: status || (includePast || date ? 'all' : 'active'),
            date: date || 'all',
            patientName: patientName || '',
            includePast: includePast === 'true'
          }
        }
      });
    } catch (err) {
      console.error('Chaincode error:', err);
      res.status(500).json({ success: false, message: err.message });
    } 

  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /hospitals/:email/appointments/upcoming
app.get('/hospitals/:email/appointments/upcoming', async (req, res) => {
  try {
    const { email } = req.params;
    const {
      status,
      date,
      patientName,
      doctorName,
      limit = 20,
      page = 1,
      includePast = false
    } = req.query;

    // Find hospital by email (case‑insensitive)
    const hospital = await Hospital.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Get all doctors belonging to this hospital
    const doctors = await Doctor.find({ hospital_id: hospital._id }).select('_id name consultationFee');
    const doctorIds = doctors.map(doc => doc._id.toString());

    // If no doctors, return empty result early
    if (doctorIds.length === 0) {
      return res.json({
        success: true,
        data: {
          appointments: [],
          hospital: {
            email: hospital.email,
            name: hospital.name
          },
          statistics: {
            totalUpcoming: 0,
            totalEarnings: 0,
            byStatus: {}
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          },
          filters: {
            status: status || (includePast || date ? 'all' : 'active'),
            date: date || 'all',
            patientName: patientName || '',
            doctorName: doctorName || '',
            includePast: includePast === 'true'
          }
        }
      });
    }

    // Build base query
    let query = { doctorId: { $in: doctorIds } };

    // Date filtering
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    } else if (!(includePast === 'true' || includePast === true)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.date = { $gte: today };
    }

    // Status filtering
    if (status && status !== 'all') {
      query.status = status;
    } else {
      if (date) {
        query.status = { $in: ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'] };
      } else if (includePast === 'true' || includePast === true) {
        query.status = { $in: ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'] };
      } else {
        query.status = { $in: ['scheduled', 'confirmed', 'checked-in', 'in-consultation','completed'] };
      }
    }

    // Patient name filter – works for both registered and guest appointments
    if (patientName) {
      const matchingPatients = await Patient.find({
        name: { $regex: new RegExp(patientName, 'i') }
      }).select('_id');
      const patientIds = matchingPatients.map(p => p._id);
      const orConditions = [];
      if (patientIds.length) {
        orConditions.push({ patientId: { $in: patientIds } });
      }
      orConditions.push({
        isGuest: true,
        patientName: { $regex: new RegExp(patientName, 'i') }
      });
      query.$or = orConditions;
    }

    // Doctor name filter (directly on appointment.doctorName)
    if (doctorName) {
      query.doctorName = { $regex: new RegExp(doctorName, 'i') };
    }

    // Execute paginated query
    const appointments = await Appointment.find(query)
      .populate('patientId', 'patientId username name email phoneNo dateOfBirth gender bloodGroup address')
      .sort({ date: 1, timeSlot: 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    // Format appointments (include guest patient info)
    const formattedAppointments = appointments.map(appointment => {
      if (appointment.isGuest) {
        return {
          appointmentId: appointment._id,
          appointmentNumber: appointment.appointmentId,
          date: appointment.date,
          timeSlot: appointment.timeSlot,
          status: appointment.status,
          paymentStatus:appointment.paymentStatus,
          reason: appointment.reason,
          notes: appointment.notes,
          doctorName: appointment.doctorName,
          doctorSpecialization: appointment.doctorSpecialization,
          patient: {
            name: appointment.guestDetails?.name || appointment.patientName,
            phoneNo: appointment.guestDetails?.phone || 'N/A',
            email: appointment.guestDetails?.email,
            age: appointment.guestDetails?.age,
            isGuest: true
          },
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt
        };
      } else {
        const patient = appointment.patientId;
        return {
          appointmentId: appointment._id,
          appointmentNumber: appointment.appointmentId,
          date: appointment.date,
          timeSlot: appointment.timeSlot,
          status: appointment.status,
          paymentStatus:appointment.paymentStatus,
          reason: appointment.reason,
          notes: appointment.notes,
          doctorName: appointment.doctorName,
          doctorSpecialization: appointment.doctorSpecialization,
          patient: patient ? {
            patientId: patient.patientId,
            username: patient.username,
            name: patient.name,
            email: patient.email,
            phoneNo: patient.phoneNo,
            dateOfBirth: patient.dateOfBirth,
            gender: patient.gender,
            bloodGroup: patient.bloodGroup,
            address: patient.address,
            age: patient.dateOfBirth ?
              new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : null,
            isGuest: false
          } : null,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt
        };
      }
    });

    // Total appointments count (for pagination)
    const totalAppointments = await Appointment.countDocuments(query);

    // ================================================================
    // NEW: Calculate total earnings from completed appointments using paymentAmount
    // ================================================================
    const earningsResult = await Appointment.aggregate([
      {
        $match: {
          doctorId: { $in: doctorIds },
          status: 'completed'
        }
      },
      {
        $lookup: {
          from: 'doctors',
          let: { docId: { $toObjectId: '$doctorId' } },   // convert string to ObjectId
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$docId'] } } }
          ],
          as: 'doctor'
        }
      },
      { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: ['$paymentAmount', 0]
            }
          }
        }
      }
    ]);
    const totalEarnings = earningsResult.length > 0 ? earningsResult[0].total : 0;

    // Status counts
    const statusCounts = await Appointment.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const byStatus = {};
    statusCounts.forEach(item => { byStatus[item._id] = item.count; });

    res.json({
      success: true,
      data: {
        appointments: formattedAppointments,
        hospital: {
          email: hospital.email,
          name: hospital.name,
          mspId: hospital.mspId,
          tier: hospital.tier
        },
        statistics: {
          totalUpcoming: totalAppointments,
          totalEarnings: totalEarnings,
          byStatus
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalAppointments,
          pages: Math.ceil(totalAppointments / parseInt(limit))
        },
        filters: {
          status: status || (includePast || date ? 'all' : 'active'),
          date: date || 'all',
          patientName: patientName || '',
          doctorName: doctorName || '',
          includePast: includePast === 'true'
        }
      }
    });

  } catch (error) {
    console.error('Error fetching hospital appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching appointments',
      error: error.message
    });
  }
});

app.put('/update-doctor-profile', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Check if doctor exists
    const existingDoctor = await Doctor.findOne({ username });
    if (!existingDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const {
      subSpecialization,
      qualifications,
      totalExperience,
      bio,
      languages,
      address,
      profilePhoto
    } = req.body;

    // Prepare update object
    const updateData = {
      updatedAt: new Date()
    };

    // Handle totalExperience - can be updated directly
    if (totalExperience !== "") {
      if (totalExperience < 0 || totalExperience > 60) {
        return res.status(400).json({
          success: false,
          message: 'Total experience must be between 0 and 60 years'
        });
      }
      updateData.totalExperience = totalExperience;
    }

    // Handle bio - can be updated directly
    if (bio !== "") {
      updateData.bio = bio;
    }

    if (profilePhoto!=""){
      updateData.profilePhoto=profilePhoto;
    }

    // Handle subSpecialization - append new items, remove duplicates
    if (subSpecialization && Array.isArray(subSpecialization)) {
      const existingSubSpecializations = existingDoctor.subSpecialization || [];
      const newSubSpecializations = subSpecialization.filter(item => 
        item && item.trim() !== "" && !existingSubSpecializations.includes(item.trim())
      );
      
      if (newSubSpecializations.length > 0) {
        updateData.$push = {
          ...updateData.$push,
          subSpecialization: { $each: newSubSpecializations }
        };
      }
    }

    // Handle languages - append new items, remove duplicates
    if (languages && Array.isArray(languages)) {
      const existingLanguages = existingDoctor.languages || [];
      const newLanguages = languages.filter(item => 
        item && item.trim() !== "" && !existingLanguages.includes(item.trim())
      );
      
      if (newLanguages.length > 0) {
        updateData.$push = {
          ...updateData.$push,
          languages: { $each: newLanguages }
        };
      }
    }

    // Handle qualifications - append new items, validate structure
    if (qualifications && Array.isArray(qualifications)) {
      const existingQualifications = existingDoctor.qualifications || [];
      const newQualifications = [];

      for (const qual of qualifications) {
        // Validate qualification structure
        if (qual.degree && qual.institution && qual.year) {
          // Check if this qualification already exists
          const isDuplicate = existingQualifications.some(existingQual =>
            existingQual.degree === qual.degree &&
            existingQual.institution === qual.institution &&
            existingQual.year === qual.year
          );

          if (!isDuplicate) {
            newQualifications.push({
              degree: qual.degree.trim(),
              institution: qual.institution.trim(),
              year: qual.year
            });
          }
        }
      }

      if (newQualifications.length > 0) {
        updateData.$push = {
          ...updateData.$push,
          qualifications: { $each: newQualifications }
        };
      }
    }

    // Handle address - merge with existing address
    if (address && typeof address === 'object') {
      const existingAddress = existingDoctor.address || {};
      updateData.address = {
        ...existingAddress,
        ...address
      };
    }

    // Remove empty $push if no array updates
    if (updateData.$push && Object.keys(updateData.$push).length === 0) {
      delete updateData.$push;
    }

    // Update doctor information
    const updatedDoctor = await Doctor.findOneAndUpdate(
      { username },
      updateData,
      { 
        new: true, 
        runValidators: true,
        select: '-password' 
      }
    );

    if (!updatedDoctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found after update'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        updatedFields: Object.keys(updateData).filter(key => 
          key !== 'updatedAt' && key !== '$push'
        ),
        addedItems: {
          subSpecialization: updateData.$push?.subSpecialization?.$each || [],
          languages: updateData.$push?.languages?.$each || [],
          qualifications: updateData.$push?.qualifications?.$each || []
        }
      }
    });

  } catch (error) {
    console.error('Error updating doctor profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// PUT /update-hospital-profile
app.put('/update-hospital-profile', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Optional: check if hospital exists and has proper role/permissions
    // You may have a service like service.ifHospitalExist(email)
    // For now, we'll directly query the hospital

    const existingHospital = await Hospital.findOne({
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });

    if (!existingHospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    const {
      name,
      phoneNo,
      address,
      profilePhoto,
      tier,
      walletpath
    } = req.body;

    // Prepare update object
    const updateData = {
      updatedAt: new Date()
    };

    // Update simple fields if provided
    if (name !== undefined && name !== "") {
      updateData.name = name.trim();
    }

    if (phoneNo !== undefined && phoneNo !== "") {
      updateData.phoneNo = phoneNo.trim();
    }

    if (profilePhoto !== undefined && profilePhoto !== "") {
      updateData.profilePhoto = profilePhoto;
    }

    if (tier !== undefined && tier !== "") {
      // Optional: validate tier values (if you have an enum or allowed list)
      updateData.tier = tier.trim();
    }

    if (walletpath !== undefined && walletpath !== "") {
      updateData.walletpath = walletpath.trim();
    }

    // Handle address – merge with existing address
    if (address && typeof address === 'object') {
      const existingAddress = existingHospital.address || {};
      updateData.address = {
        ...existingAddress,
        ...address
      };
    }

    // Perform the update
    const updatedHospital = await Hospital.findOneAndUpdate(
      { email: existingHospital.email }, // use original email to avoid case sensitivity issues
      updateData,
      {
        new: true,
        runValidators: true,
        select: '-password -doctorReferences -appointmentReferences -blockchainStatus'
      }
    );

    if (!updatedHospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found after update'
      });
    }

    // Format response
    const responseData = {
      id: updatedHospital._id,
      email: updatedHospital.email,
      name: updatedHospital.name,
      mspId: updatedHospital.mspId,
      collectionname: updatedHospital.collectionname,
      tier: updatedHospital.tier,
      phoneNo: updatedHospital.phoneNo,
      address: updatedHospital.address,
      profilePhoto: updatedHospital.profilePhoto,
      isVerified: updatedHospital.isVerified,
      walletpath: updatedHospital.walletpath,
      stats: updatedHospital.stats,
      createdAt: updatedHospital.createdAt,
      updatedAt: updatedHospital.updatedAt
    };

    res.json({
      success: true,
      message: 'Hospital profile updated successfully',
      data: {
        hospital: responseData,
        updatedFields: Object.keys(updateData).filter(key => key !== 'updatedAt')
      }
    });

  } catch (error) {
    console.error('Error updating hospital profile:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Helper function to get doctor's upcoming availability
async function getDoctorUpcomingAvailability(doctorId, startDate, endDate) {
  const availableDates = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const availability = await getDoctorAvailability(doctorId, dateStr);
    
    if (availability.isAvailable && availability.availableSlots.length > 0) {
      availableDates.push({
        date: dateStr,
        availableSlots: availability.availableSlots.filter(slot => slot.available).length
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return { availableDates };
}

async function getDoctorAvailability(doctorId, date) {
  try {
    // Find doctor with schedule data
    const doctor = await Doctor.findById(doctorId)
      .select('weeklySchedule scheduleOverrides blockedSlots');
    
    if (!doctor) {
      throw new Error('Doctor not found');
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[dayOfWeek];
    const dateString = targetDate.toISOString().split('T')[0];

    // Check for schedule override first
    const override = doctor.scheduleOverrides.find(ov => {
      const overrideDate = new Date(ov.date).toISOString().split('T')[0];
      return overrideDate === dateString;
    });

    let availableSlots = [];

    if (override) {
      // Use override schedule
      if (override.isWorking && override.slots) {
        availableSlots = override.slots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPatients: slot.maxPatients || 1,
          type: 'override'
        }));
      }
    } else {
      // Use weekly schedule
      const daySchedule = doctor.weeklySchedule.find(schedule => 
        schedule.day.toLowerCase() === dayName
      );

      if (daySchedule && daySchedule.isWorking && daySchedule.slots) {
        availableSlots = daySchedule.slots.map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          maxPatients: slot.maxPatients || 1,
          type: 'regular'
        }));
      }
    }

    // Filter out blocked slots
    const blockedSlotsForDate = doctor.blockedSlots.filter(blocked => {
      const blockedDate = new Date(blocked.date).toISOString().split('T')[0];
      return blockedDate === dateString;
    });

    if (blockedSlotsForDate.length > 0) {
      availableSlots = availableSlots.filter(slot => {
        const slotTimeRange = `${slot.startTime}-${slot.endTime}`;
        return !blockedSlotsForDate.some(blocked => 
          blocked.timeSlot === slotTimeRange
        );
      });
    }

    // Get existing appointments for this date to calculate remaining capacity
    const appointments = await Appointment.find({
      doctor: doctorId,
      date: {
        $gte: new Date(dateString + 'T00:00:00.000Z'),
        $lt: new Date(dateString + 'T23:59:59.999Z')
      },
      status: { $in: ['scheduled', 'confirmed'] }
    });

    // Calculate available capacity for each slot
    const slotsWithAvailability = availableSlots.map(slot => {
      const slotAppointments = appointments.filter(apt => {
        const aptTime = apt.timeSlot; // Assuming timeSlot is stored as "HH:MM-HH:MM"
        return aptTime === `${slot.startTime}-${slot.endTime}`;
      });

      const bookedCount = slotAppointments.length;
      const availableCapacity = slot.maxPatients - bookedCount;

      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        maxPatients: slot.maxPatients,
        bookedCount,
        availableCapacity,
        isAvailable: availableCapacity > 0,
        type: slot.type
      };
    });

    return {
      date: dateString,
      day: dayName,
      isAvailable: slotsWithAvailability.length > 0,
      availableSlots: slotsWithAvailability,
      totalSlots: slotsWithAvailability.length,
      availableSlotsCount: slotsWithAvailability.filter(slot => slot.isAvailable).length,
      hasOverride: !!override,
      overrideReason: override?.reason
    };

  } catch (error) {
    console.error('Error getting doctor availability:', error);
    throw error;
  }
}

app.post('/doctors/schedule/weekly', async (req, res) => {
  try {
    const { username, weeklySchedule } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }
    // const exist=await service.ifDocExist(username);
    // console.log(`Doctor profile updated for user: ${username} ${exist}`);

    // if(!exist){
    //   return res.status(403).json({ 
    //       success: false, 
    //       message: 'Access denied. Doctor role required.' 
    //   });
    // }

    // Check if doctor exists
    const doctor = await Doctor.findOne({ username });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Validate weekly schedule structure
    if (!Array.isArray(weeklySchedule)) {
      return res.status(400).json({
        success: false,
        message: 'Weekly schedule must be an array'
      });
    }

    const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // Create a copy of existing weekly schedule or initialize if doesn't exist
    let updatedWeeklySchedule = doctor.weeklySchedule ? [...doctor.weeklySchedule] : [];
    
    // If no existing schedule, initialize with all days as non-working
    if (updatedWeeklySchedule.length === 0) {
      updatedWeeklySchedule = validDays.map(day => ({
        day,
        isWorking: false,
        slots: []
      }));
    }
    
    // Update only the days provided in the request
    for (const daySchedule of weeklySchedule) {
      if (!validDays.includes(daySchedule.day)) {
        return res.status(400).json({
          success: false,
          message: `Invalid day: ${daySchedule.day}. Must be one of: ${validDays.join(', ')}`
        });
      }
    
      // Find the existing day schedule
      const existingDayIndex = updatedWeeklySchedule.findIndex(
        schedule => schedule.day === daySchedule.day
      );
      
      if (existingDayIndex === -1) {
        // If day doesn't exist in current schedule, add it
        updatedWeeklySchedule.push({
          day: daySchedule.day,
          isWorking: false,
          slots: []
        });
      }
      
      // Update the specific day with new data
      const currentDayIndex = updatedWeeklySchedule.findIndex(
        schedule => schedule.day === daySchedule.day
      );
      
      // Update isWorking status if provided, otherwise keep existing
      if (daySchedule.isWorking !== undefined) {
        updatedWeeklySchedule[currentDayIndex].isWorking = daySchedule.isWorking;
      }
      
      // Auto-set isWorking to true if slots are provided but isWorking is not specified
      if (daySchedule.slots && daySchedule.slots.length > 0 && daySchedule.isWorking === undefined) {
        updatedWeeklySchedule[currentDayIndex].isWorking = true;
      }
    
      // Validate and update slots if provided
      if (daySchedule.slots !== undefined) {
        // If slots array is provided, replace existing slots
        if (Array.isArray(daySchedule.slots)) {
          // Validate slots if doctor is working this day
          if (updatedWeeklySchedule[currentDayIndex].isWorking && daySchedule.slots.length > 0) {
            for (const slot of daySchedule.slots) {
              if (!slot.startTime || !slot.endTime) {
                return res.status(400).json({
                  success: false,
                  message: `Each slot must have startTime and endTime for ${daySchedule.day}`
                });
              }
              
              // Validate time format (HH:MM)
              const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
              if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
                return res.status(400).json({
                  success: false,
                  message: `Invalid time format for ${daySchedule.day}. Use HH:MM format`
                });
              }
        
              // Set default maxPatients if not provided
              if (slot.maxPatients === undefined) {
                slot.maxPatients = 1;
              }
            }
            updatedWeeklySchedule[currentDayIndex].slots = daySchedule.slots;
          } else if (updatedWeeklySchedule[currentDayIndex].isWorking && daySchedule.slots.length === 0) {
            return res.status(400).json({
              success: false,
              message: `Working day ${daySchedule.day} must have at least one time slot`
            });
          } else {
            // If not working, clear slots
            updatedWeeklySchedule[currentDayIndex].slots = [];
          }
        }
      }
      // If slots are not provided in request, keep existing slots
    }

    // Update weekly schedule
    doctor.weeklySchedule = updatedWeeklySchedule;
    await doctor.save();

    res.json({
      success: true,
      message: 'Weekly schedule updated successfully',
      data: {
        weeklySchedule: doctor.weeklySchedule
      }
    });

  } catch (error) {
    console.error('Error updating weekly schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.post('/doctors/schedule/override', async (req, res) => {
  try {
    const { username, date, isWorking, reason, slots } = req.body;

    if (!username || !date) {
      return res.status(400).json({
        success: false,
        message: 'Username and date are required'
      });
    }
    const exist=await service.ifDocExist(username);
    console.log(`Doctor profile updated for user: ${username} ${exist}`);

    if(!exist){
      return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Doctor role required.' 
      });
    }

    const doctor = await Doctor.findOne({ username });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Validate date
    const overrideDate = new Date(date);
    if (isNaN(overrideDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Check if override already exists for this date
    const existingOverrideIndex = doctor.scheduleOverrides.findIndex(
      override => override.date.toDateString() === overrideDate.toDateString()
    );

    const overrideData = {
      date: overrideDate,
      isWorking: Boolean(isWorking),
      reason: reason || (isWorking ? 'Special working day' : 'Day off'),
      slots: slots || []
    };

    if (existingOverrideIndex !== -1) {
      // Update existing override
      doctor.scheduleOverrides[existingOverrideIndex] = overrideData;
    } else {
      // Add new override
      doctor.scheduleOverrides.push(overrideData);
    }

    await doctor.save();

    res.json({
      success: true,
      message: existingOverrideIndex !== -1 ? 'Schedule override updated' : 'Schedule override added',
      data: {
        override: overrideData
      }
    });

  } catch (error) {
    console.error('Error managing schedule override:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.post('/doctors/schedule/block-slot', async (req, res) => {
  try {
    const { username, date, timeSlot, reason } = req.body;

    if (!username || !date || !timeSlot) {
      return res.status(400).json({
        success: false,
        message: 'Username, date, and timeSlot are required'
      });
    }
    const exist=await service.ifDocExist(username);
    console.log(`Doctor profile updated for user: ${username} ${exist}`);

    if(!exist){
      return res.status(403).json({ 
          success: false, 
          message: 'Access denied. Doctor role required.' 
      });
    }

    const doctor = await Doctor.findOne({ username });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const blockDate = new Date(date);
    if (isNaN(blockDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Validate timeSlot format (HH:MM-HH:MM)
    const timeSlotRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]-([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeSlotRegex.test(timeSlot)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid timeSlot format. Use HH:MM-HH:MM format'
      });
    }

    // Check if slot is already blocked
    const existingBlockIndex = doctor.blockedSlots.findIndex(
      block => block.date.toDateString() === blockDate.toDateString() && 
               block.timeSlot === timeSlot
    );

    const blockData = {
      date: blockDate,
      timeSlot,
      reason: reason || 'Temporarily unavailable'
    };

    if (existingBlockIndex !== -1) {
      // Update existing block
      doctor.blockedSlots[existingBlockIndex] = blockData;
    } else {
      // Add new block
      doctor.blockedSlots.push(blockData);
    }

    await doctor.save();

    res.json({
      success: true,
      message: existingBlockIndex !== -1 ? 'Time slot block updated' : 'Time slot blocked successfully',
      data: {
        blockedSlot: blockData
      }
    });

  } catch (error) {
    console.error('Error blocking time slot:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.get('/doctors/schedule/availability', async (req, res) => {
  try {
    const { username, date } = req.query;

    if (!username || !date) {
      return res.status(400).json({
        success: false,
        message: 'Username and date are required'
      });
    }

    const doctor = await Doctor.findOne({ username });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    const dayName = targetDate.toLocaleString('en-us', { weekday: 'long' }).toLowerCase();

    // Check for date-specific override first
    const override = doctor.scheduleOverrides.find(
      o => o.date.toDateString() === targetDate.toDateString()
    );

    let isAvailable = false;
    let availableSlots = [];
    let reason = '';

    if (override) {
      // Use override schedule
      isAvailable = override.isWorking;
      reason = override.reason;
      
      if (isAvailable && override.slots && override.slots.length > 0) {
        availableSlots = await getAvailableSlots(doctor._id, targetDate, override.slots);
      }
    } else {
      // Use regular weekly schedule
      const daySchedule = doctor.weeklySchedule.find(s => s.day === dayName);
      if (daySchedule && daySchedule.isWorking) {
        isAvailable = true;
        if (daySchedule.slots && daySchedule.slots.length > 0) {
          availableSlots = await getAvailableSlots(doctor._id, targetDate, daySchedule.slots);
        }
      } else {
        reason = 'Not working on this day';
      }
    }

    // Remove blocked slots
    const blockedSlotsForDate = doctor.blockedSlots.filter(
      block => block.date.toDateString() === targetDate.toDateString()
    );

    availableSlots = availableSlots.map(slot => {
      const isBlocked = blockedSlotsForDate.some(block => block.timeSlot === slot.timeSlot);
      return {
        ...slot,
        available: slot.available && !isBlocked,
        blocked: isBlocked,
        blockReason: isBlocked ? blockedSlotsForDate.find(block => block.timeSlot === slot.timeSlot)?.reason : null
      };
    });

    res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        day: dayName,
        isAvailable,
        reason,
        availableSlots,
        hasOverride: !!override,
        overrideReason: override?.reason
      }
    });

  } catch (error) {
    console.error('Error getting schedule availability:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});


app.get('/patients/:username', async (req, res) => {
  try {
    const { username } = req.params;

    // Get patient with appointment references
    const patient = await Patient.findOne({ username })
      .select('-password -blockchainPatientId -publicKey');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get latest consultation vitals from appointments
    const latestAppointment = await Appointment.findOne(
      { 
        patientId: patient._id.toString(),
        status: 'completed',
        'consultation.vitalSigns': { $exists: true, $ne: null }
      }
    )
    .sort({ completedAt: -1 })
    .select('consultation.vitalSigns consultation.diagnosis date doctorName');

    // Get all completed appointments with vital signs to find the most recent value for each vital
    const allVitalAppointments = await Appointment.find({
      patientId: patient._id.toString(),
      status: 'completed',
      'consultation.vitalSigns': { $exists: true, $ne: null }
    })
    .sort({ completedAt: -1 })
    .select('consultation.vitalSigns completedAt');

    // Build comprehensive vital signs from all available data
    let comprehensiveVitalSigns = {};
    
    if (allVitalAppointments.length > 0) {
      // Start with the latest appointment's vital signs
      if (latestAppointment && latestAppointment.consultation.vitalSigns) {
        comprehensiveVitalSigns = { ...latestAppointment.consultation.vitalSigns };
      }
      
      // Fill in missing vitals from previous appointments
      for (const appointment of allVitalAppointments) {
        const vitals = appointment.consultation.vitalSigns;
        
        // Only add vital if it's not already present in comprehensiveVitalSigns
        if (vitals.bloodPressure && !comprehensiveVitalSigns.bloodPressure) {
          comprehensiveVitalSigns.bloodPressure = vitals.bloodPressure;
        }
        if (vitals.heartRate && !comprehensiveVitalSigns.heartRate) {
          comprehensiveVitalSigns.heartRate = vitals.heartRate;
        }
        if (vitals.temperature && !comprehensiveVitalSigns.temperature) {
          comprehensiveVitalSigns.temperature = vitals.temperature;
        }
        if (vitals.weight && !comprehensiveVitalSigns.weight) {
          comprehensiveVitalSigns.weight = vitals.weight;
        }
        if (vitals.spo2 && !comprehensiveVitalSigns.spo2) {
          comprehensiveVitalSigns.spo2 = vitals.spo2;
        }
        
        // If all vitals are filled, break early
        if (comprehensiveVitalSigns.bloodPressure && comprehensiveVitalSigns.heartRate && 
            comprehensiveVitalSigns.temperature && comprehensiveVitalSigns.weight && comprehensiveVitalSigns.spo2) {
          break;
        }
      }
    }

    // Get upcoming appointments
    const upcomingAppointments = await Appointment.find({
      patientId: patient._id.toString(),
      status: { $in: ['scheduled', 'confirmed'] }
    })
    .sort({ bookedAt: 1 })
    .select('appointmentId date timeSlot doctorName doctorSpecialization status reason')
    .limit(5);

    // Get all consultation history (completed appointments with consultation data)
    const consultationHistory = await Appointment.find({
      patientId: patient._id.toString(),
      status: 'completed',
      $or: [
        { 'consultation.vitalSigns': { $exists: true, $ne: null } },
        { 'consultation.diagnosis': { $exists: true, $ne: null } },
        { 'consultation.prescriptions': { $exists: true, $ne: null } },
        { 'consultation.notes': { $exists: true, $ne: null } }
      ]
    })
    .sort({ completedAt: -1 })
    .select('appointmentId date timeSlot doctorName doctorSpecialization consultation completedAt')
    .populate('doctorId', 'username specialization -_id');

    // Get appointment statistics
    const appointmentStats = await Appointment.aggregate([
      { $match: { patientId: patient._id.toString() } },
      { $group: { 
        _id: '$status', 
        count: { $sum: 1 } 
      }}
    ]);

    // Format consultation history for response
    const formattedConsultationHistory = consultationHistory.map(apt => ({
      appointmentId: apt.appointmentId,
      date: apt.date,
      timeSlot: apt.timeSlot,
      doctor: {
        name: apt.doctorName,
        specialization: apt.doctorSpecialization
      },
      consultation: apt.consultation ? {
        vitalSigns: apt.consultation.vitalSigns || {},
        diagnosis: apt.consultation.diagnosis || '',
        prescriptions: apt.consultation.prescription || [],
        notes: apt.consultation.notes || '',
        followUpDate: apt.consultation.followUpDate || null,
        testsRecommended: apt.consultation.testsRecommended || []
      } : null,
      completedAt: apt.completedAt
    }));

    // Format the response - KEEPING THE SAME FORMAT
    const patientData = {
      basicInfo: {
        id: patient._id,
        username: patient.username,
        name: patient.name,
        email: patient.email,
        phoneNo: patient.phoneNo,
        dateOfBirth: patient.dateOfBirth,
        age: patient.age, // Using virtual property
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        profilePhoto: patient.profilePhoto
      },
      medicalInfo: {
        weight: patient.weight,
        height: patient.height,
        bmi: patient.bmi,
        medicalHistory: patient.medicalHistory,
        allergies: patient.allergies,
        currentMedications: patient.currentMedications,
        chronicConditions: patient.chronicConditions,
        familyHistory: patient.familyHistory,
        surgicalHistory: patient.surgicalHistory
      },
      contactInfo: {
        address: patient.address,
        emergencyContact: patient.emergencyContact
      },
      latestVitals: latestAppointment ? {
        date: latestAppointment.date,
        doctor: latestAppointment.doctorName,
        diagnosis: latestAppointment.consultation.diagnosis,
        vitalSigns: comprehensiveVitalSigns // Use the comprehensive vital signs instead of just latest
      } : null,
      upcomingAppointments: upcomingAppointments,
      consultationHistory: formattedConsultationHistory,
      statistics: {
        totalAppointments: patient.appointmentReferences.length,
        totalConsultations: consultationHistory.length,
        statusBreakdown: appointmentStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        completedConsultations: appointmentStats.find(stat => stat._id === 'completed')?.count || 0
      },
      profileCompleted: patient.profileCompleted
    };

    res.json({
      success: true,
      data: patientData
    });

  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.put('/patient/:username/cancel', async (req, res) => {
  try {
    const { username } = req.params;
    const { appointmentId } = req.query;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
    }

    // Verify patient exists
    const patient = await Patient.findOne({ username });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    console.log(patient);
    // Find the appointment
    const appointment = await Appointment.findOne({ 
      _id:appointmentId,
      patientId: patient._id 
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found or does not belong to this patient'
      });
    }
    const doctor = await Doctor.findById(new mongoose.Types.ObjectId(appointment.doctorId)).select('hospital_name');
    if (!doctor) {
      return res.status(403).json({ success: false, message: 'Doctor not found' });
    }

    // Check if appointment can be cancelled
    const cancellableStatuses = ['scheduled', 'confirmed'];
    if (!cancellableStatuses.includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Appointment cannot be cancelled. Current status: ${appointment.status}. Only scheduled or confirmed appointments can be cancelled.`
      });
    }

    // Check if appointment is in the future
    const appointmentDate = new Date(appointment.date);
    const now = new Date();
    
    if (appointmentDate <= now) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel past or ongoing appointments'
      });
    }

    // Update appointment status
    const previousStatus = appointment.status;
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();

    // Add to status history
    appointment.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      changedBy: 'patient'
    });

    // Save updated appointment
    const updatedAppointment = await appointment.save();

    // Update blockchain status
    try {
      const fb = new FabricClient('./full-connection.json', wallet, username);
      await fb.initialize();
      await fb.updateAppointmentStatus(appointmentId, 'cancelled', doctor.hospital_name);
      console.log('✅ Appointment status updated on blockchain');
      console.log('✅ Appointment cancellation recorded on blockchain');
    } catch (blockchainError) {
      console.error('❌ Blockchain update failed:', blockchainError);
      // Continue even if blockchain update fails
    }
    await sendEmail({
      to: patient.email,
      cc: doctor.email,
      subject: 'Appointment Cancellation Successful',
      html: `<p>Dear ${patient.name}, your appointment with Dr. ${doctor.name} is cancelled refund would be initiated!</p>
             <p>Appointment ID: ${appointment._id.toString()}</p>
             <p>Date: ${appointment.date.toLocaleDateString()}</p>
             <p>Time: ${appointment.timeSlot}</p>
             <p>Payment ID: ${appointment.paymentID}</p>`
     });

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: {
        appointmentId: updatedAppointment.appointmentId,
        previousStatus,
        newStatus: updatedAppointment.status,
        cancelledAt: updatedAppointment.cancelledAt,
        patient: {
          username: patient.username,
          name: patient.name
        }
      }
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling appointment',
      error: error.message
    });
  }
});
// Helper function to get available slots considering existing appointments
async function getAvailableSlots(doctorId, date, slots) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const appointments = await Appointment.find({
    doctorId,
    date: { $gte: start, $lt: end },
    status: { $in: ['scheduled', 'confirmed', 'checked-in'] }
  });

  return slots.map(slot => {
    const timeSlot = `${slot.startTime}-${slot.endTime}`;
    const maxPatients = slot.maxPatients || 1;
    const bookedCount = appointments.filter(apt => apt.timeSlot === timeSlot).length;
    const isAvailable = bookedCount < maxPatients;

    return {
      timeSlot,
      startTime: slot.startTime,
      endTime: slot.endTime,
      available: isAvailable,
      bookedCount,
      maxPatients,
      remainingSlots: maxPatients - bookedCount
    };
  });
}

app.post('/fill-patient-info', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }
    // Check if patient exists
    const patient = await Patient.findOne({ username:username });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const {
      dateOfBirth,
      gender,
      bloodGroup,
      weight,
      height,
      address,
      medicalHistory,
      allergies,
      currentMedications,
      chronicConditions,
      familyHistory,
      surgicalHistory,
      emergencyContact
    } = req.body;

    // Validate gender enum
    const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
    if (gender && !validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender value'
      });
    }

    // Validate blood group enum
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
    if (bloodGroup && !validBloodGroups.includes(bloodGroup)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blood group'
      });
    }

    // Validate weight and height ranges
    if (weight && (weight < 20 || weight > 300)) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be between 20kg and 300kg'
      });
    }

    if (height && (height < 100 || height > 250)) {
      return res.status(400).json({
        success: false,
        message: 'Height must be between 100cm and 250cm'
      });
    }

    // Validate date of birth (not in future and reasonable age)
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      
      if (dob > today) {
        return res.status(400).json({
          success: false,
          message: 'Date of birth cannot be in the future'
        });
      }
      
      if (age > 120) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid date of birth'
        });
      }
    }

    // Calculate BMI if weight and height are provided
    let bmi = null;
    if (weight && height) {
      const heightInMeters = height / 100;
      bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(2));
    }
    const fb = new FabricClient(
      './full-connection.json',
      wallet,
      username
    );
    await fb.initialize();
    await fb.storePatientPrivateDetails(
        patient._id.toString(),
        parseFloat(height),
        parseFloat(weight),
        bmi,
        bloodGroup,
        allergies||[],
        currentMedications || [],
        chronicConditions || [],
        familyHistory || '',
        surgicalHistory || [],
        medicalHistory || '',
        emergencyContact.phoneNo||''
    );


    // Update patient information
    const updatedPatient = await Patient.findOneAndUpdate(
      { username },
      {
        $set: {
          dateOfBirth: dateOfBirth || null,
          gender: gender || 'Prefer not to say',
          bloodGroup: bloodGroup || 'Unknown',
          weight: weight || null,
          height: height || null,
          bmi: bmi,
          address: address || {},
          medicalHistory: medicalHistory || '',
          allergies: allergies || [],
          currentMedications: currentMedications || [],
          chronicConditions: chronicConditions || [],
          familyHistory: familyHistory || '',
          surgicalHistory: surgicalHistory || [],
          emergencyContact: emergencyContact || {},
          profileCompleted: true
        }
      },
      { 
        new: true, 
        runValidators: true,
        select: '-password' 
      }
    );

    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found after update'
      });
    }

    res.json({
      success: true,
      message: 'Personal information updated successfully',
    });

  } catch (error) {
    console.error('Error updating patient personal info:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.put('/update-patient-profile', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    // Check if patient exists
    const existingPatient = await Patient.findOne({ username: username });
    if (!existingPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    const {
      dateOfBirth,
      gender,
      bloodGroup,
      weight,
      height,
      address,
      allergies,
      currentMedications,
      chronicConditions,
      familyHistory,
      surgicalHistory,
      emergencyContact
    } = req.body;
    
    
    // Validate gender enum
    const validGenders = ['Male', 'Female', 'Other', 'Prefer not to say'];
    if (gender && !validGenders.includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gender value'
      });
    }
    
    // Validate blood group enum
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
    if (bloodGroup && !validBloodGroups.includes(bloodGroup)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid blood group'
      });
    }

    // Validate weight and height ranges
    if (weight && (weight < 20 || weight > 300)) {
      return res.status(400).json({
        success: false,
        message: 'Weight must be between 20kg and 300kg'
      });
    }

    if (height && (height < 100 || height > 250)) {
      return res.status(400).json({
        success: false,
        message: 'Height must be between 100cm and 250cm'
      });
    }

    // Validate date of birth
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      
      if (dob > today) {
        return res.status(400).json({
          success: false,
          message: 'Date of birth cannot be in the future'
        });
      }
      
      if (age > 120) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid date of birth'
        });
      }
    }
    
    
    // FIXED: Validate address if provided - only validate if address object exists and has values
    if (address && Object.keys(address).length > 0) {
      // Check if any address field has a non-empty value
      const hasAddressData = Object.values(address).some(value => 
        value && value.toString().trim() !== ''
      );
      
      if (hasAddressData) {
        // Only require fields if at least one field is provided
        if ((address.city && !address.state) || (!address.city && address.state)) {
          return res.status(400).json({
            success: false,
            message: 'Both city and state are required if providing address'
          });
        }
        
        if (address.pincode && !/^\d{6}$/.test(address.pincode)) {
          return res.status(400).json({
            success: false,
            message: 'Pincode must be 6 digits'
          });
        }
      }
    }
    
    
    // Calculate BMI
    let bmi = existingPatient.bmi;
    if (weight && height) {
      const heightInMeters = height / 100;
      bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(2));
    } else if (weight && existingPatient.height) {
      const heightInMeters = existingPatient.height / 100;
      bmi = parseFloat((weight / (heightInMeters * heightInMeters)).toFixed(2));
    } else if (height && existingPatient.weight) {
      const heightInMeters = height / 100;
      bmi = parseFloat((existingPatient.weight / (heightInMeters * heightInMeters)).toFixed(2));
    }
    
    
    // Prepare update object
    const updateData = {
      updatedAt: new Date()
    };

    // Only update fields that are provided and valid (non-empty)
    if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
    if (gender) updateData.gender = gender;
    if (bloodGroup) updateData.bloodGroup = bloodGroup;
    if (weight !== undefined && weight !== '') updateData.weight = parseFloat(weight);
    if (height !== undefined && height !== '') updateData.height = parseFloat(height);
    if (bmi !== null) updateData.bmi = bmi;
    
    // FIXED: Only update address if it has actual data
    if (address && Object.keys(address).length > 0) {
      const hasAddressData = Object.values(address).some(value => 
        value && value.toString().trim() !== ''
      );
      if (hasAddressData) {
        // Merge with existing address, only updating provided fields
        updateData.address = {
          ...existingPatient.address,
          ...address
        };
        // Remove empty fields from the merged address
        Object.keys(updateData.address).forEach(key => {
          if (!updateData.address[key] || updateData.address[key].toString().trim() === '') {
            delete updateData.address[key];
          }
        });
      }
    }

    // FIXED: Only update emergencyContact if it has actual data
    if (emergencyContact && Object.keys(emergencyContact).length > 0) {
      const hasEmergencyData = Object.values(emergencyContact).some(value => 
        value && value.toString().trim() !== ''
      );
      if (hasEmergencyData) {
        updateData.emergencyContact = {
          ...existingPatient.emergencyContact,
          ...emergencyContact
        };
        // Remove empty fields
        Object.keys(updateData.emergencyContact).forEach(key => {
          if (!updateData.emergencyContact[key] || updateData.emergencyContact[key].toString().trim() === '') {
            delete updateData.emergencyContact[key];
          }
        });
      }
    }

    // FIXED: Handle array fields - filter out empty strings and append new items
    if (allergies && Array.isArray(allergies)) {
      const nonEmptyAllergies = allergies.filter(item => item && item.trim() !== '');
      if (nonEmptyAllergies.length > 0) {
        const existingAllergies = existingPatient.allergies || [];
        const combinedAllergies = [...new Set([...existingAllergies, ...nonEmptyAllergies])];
        updateData.allergies = combinedAllergies;
      }
    }

    if (currentMedications && Array.isArray(currentMedications)) {
      const nonEmptyMeds = currentMedications.filter(item => item && item.trim() !== '');
      if (nonEmptyMeds.length > 0) {
        const existingMeds = existingPatient.currentMedications || [];
        const combinedMeds = [...new Set([...existingMeds, ...nonEmptyMeds])];
        updateData.currentMedications = combinedMeds;
      }
    }

    if (chronicConditions && Array.isArray(chronicConditions)) {
      const nonEmptyConditions = chronicConditions.filter(item => item && item.trim() !== '');
      if (nonEmptyConditions.length > 0) {
        const existingConditions = existingPatient.chronicConditions || [];
        const combinedConditions = [...new Set([...existingConditions, ...nonEmptyConditions])];
        updateData.chronicConditions = combinedConditions;
      }
    }

    if (surgicalHistory && Array.isArray(surgicalHistory)) {
      const nonEmptySurgical = surgicalHistory.filter(item => item && item.trim() !== '');
      if (nonEmptySurgical.length > 0) {
        const existingSurgical = existingPatient.surgicalHistory || [];
        const combinedSurgical = [...new Set([...existingSurgical, ...nonEmptySurgical])];
        updateData.surgicalHistory = combinedSurgical;
      }
    }

    // FIXED: Handle text fields - only append if non-empty
    if (familyHistory && familyHistory.trim() !== '') {
      const existingFamilyHistory = existingPatient.familyHistory || '';
      updateData.familyHistory = existingFamilyHistory ? 
        `${existingFamilyHistory}\n\n${familyHistory}` : familyHistory;
    }

    // Remove updatedAt if no other fields to update (except updatedAt itself)
    const fieldsToUpdate = Object.keys(updateData).filter(key => key !== 'updatedAt');
    if (fieldsToUpdate.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data provided for update'
      });
    }


    // Update patient information
    const updatedPatient = await Patient.findOneAndUpdate(
      { username },
      { $set: updateData },
      { 
        new: true, 
        runValidators: true,
        select: '-password' 
      }
    );
    
    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found after update'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        updatedFields: fieldsToUpdate,
        profileCompleted: updatedPatient.profileCompleted
      }
    });

  } catch (error) {
    console.error('Error updating patient profile:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

function getSlotDurationFromTimeSlot(timeSlot) {
    const [start, end] = timeSlot.split('-');
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);
    return endMinutes - startMinutes;
}
function toMinutes(time) {
    const [hours, minutes] = time.split(':');
    return parseInt(hours) * 60 + parseInt(minutes);
}
app.post('/book-appointment', async (req, res) => {
  try {
    const { patientId, doctorId, date, timeSlot, reason, symptoms = [] } = req.body;

    // Validate inputs
    if (!patientId || !doctorId || !date || !timeSlot || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientId, doctorId, date, timeSlot, reason'
      });
    }

    // Fetch patient & doctor
    const patient = await Patient.findById(patientId).select('name username email phoneNo');
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    const doctor = await Doctor.findById(doctorId).select('name specialization username email consultationFee hospital_name hospital_id');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    if(doctor.hospital_id!=''){
      await Hospital.findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(doctor.hospital_id) },
          { $inc: { 'stats.totalAppointments': 1 } }
        );
    }

    // Check availability
    const availability = await checkDoctorAvailability(doctorId, date, timeSlot);
    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not available for the selected slot',
        details: availability.reason
      });
    }


    // Determine consultation fee (default ₹500 if not set)
    const amount = doctor.consultationFee || 500;

    // Generate unique appointment ID (for DB) and Cashfree order ID
    const appointmentId = `APT${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    const cfOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Create Cashfree order
    const orderData = {
      order_id: cfOrderId,
      order_amount: amount,
      order_currency: 'INR',
      order_note: `Appointment with Dr. ${doctor.name}`,
      customer_details: {
        customer_id: patientId.toString(),
        customer_name: patient.name,
        customer_email: patient.email,
        customer_phone: `+91${patient.phoneNo}`,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-return?order_id=${cfOrderId}`, // optional
        notify_url: `${process.env.WEBHOOK_URL}/payment-webhook`
      }
    };

    const paymentResponse = await PaymentService.createOrderUrl(orderData);

    // Create appointment record with pending payment
    const appointment = new Appointment({
      appointmentId,
      paymentID:cfOrderId,
      paymentAmount: amount,
      patientId,
      patientName: patient.name,
      doctorId,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      date: new Date(date),
      timeSlot,
      reason,
      symptoms,
      status: 'confirmed',   // or a separate field
      statusHistory: [{ status: 'confirmed', timestamp: new Date(), changedBy: 'patient' }],
      bookedAt: new Date()
    });

    await appointment.save();

    // Return payment session to frontend (the link to redirect)
    res.status(201).json({
      success: true,
      message: 'Payment initiated. Complete payment to confirm appointment.',
      data: {
        appointmentId: appointment._id,
        payment_session_id: paymentResponse.payment_session_id,
        payment_link: paymentResponse.payment_link,
        cf_order_id: cfOrderId
      }
    });

  } catch (error) {
    console.error('Error booking appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

const processedKeys = new Set();          // store already processed idempotency keys
const processingOrders = new Set();       // track orderIds currently being processed

app.post('/payment-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const rawBody = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'];

    if (idempotencyKey && processedKeys.has(idempotencyKey)) {
        console.log('Duplicate webhook detected (idempotency key):', idempotencyKey);
        return res.status(200).send('Duplicate webhook processed');
    }

    let orderId, paymentStatus, eventType;
    try {
        orderId = rawBody.data?.order?.order_id;
        paymentStatus = rawBody.data?.payment?.payment_status;
        eventType = rawBody.type;
    } catch (err) {
        console.error('Failed to parse webhook JSON:', err);
        return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }

    if (!orderId || !paymentStatus) {
        console.error('Missing order_id or payment_status in webhook');
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
      if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && paymentStatus === 'SUCCESS') {
        const appointment = await Appointment.findOne({ paymentID: orderId });
        if (!appointment) {
            console.error(`Appointment not found for order ${orderId}`);
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }
        if (appointment.paymentStatus === 'completed' ||appointment.paymentStatus === 'cancelled' ) {
            console.log(`Appointment ${appointment._id} already scheduled. Ignoring duplicate.`);
            if (idempotencyKey) processedKeys.add(idempotencyKey);
            return res.status(200).json({ success: true, message: 'Already processed' });
        }
        appointment.paymentStatus = 'completed';
        appointment.statusHistory.push({
          status: 'scheduled',
          timestamp: new Date(),
          changedBy: 'system',
          note: 'Payment successful'
        });
        await appointment.save();
        if (processingOrders.has(orderId)) {
            return res.status(200).json({ success: true, message: 'Already processing' });
        }
        processingOrders.add(orderId);
        if (idempotencyKey) processedKeys.add(idempotencyKey);
        // Schedule asynchronous processing (will not block the HTTP response)
        setImmediate(async () => {
            try {
                const patient = await Patient.findById(appointment.patientId);
                const doctor = await Doctor.findById(appointment.doctorId);
                if (!patient || !doctor) {
                    console.error(`Patient or doctor not found for appointment ${appointment._id}`);
                    return;
                }
                const fb = new FabricClient(
                    './full-connection.json',
                    wallet,
                    patient.username
                );
                await fb.initialize();
                // Create appointment on blockchain
                await fb.createAppointment(
                    appointment._id.toString(),
                    patient._id.toString(),
                    patient.name,
                    doctor._id.toString(),
                    doctor.name,
                    doctor.specialization,
                    appointment.date.toISOString().split('T')[0],
                    appointment.timeSlot,
                    appointment.reason,
                    appointment.symptoms,
                    patient._id.toString(),
                    doctor.hospital_name || '',
                    appointment.paymentID
                );
                // Grant access
                await fb.grantAccessForAppointment(
                    patient._id.toString(),
                    appointment._id.toString(),
                    ['peer0.platform.example.com', 'peer0.patients.example.com']
                );
                // Send email
                await sendEmail({
                    to: patient.email,
                    cc: doctor.email,
                    subject: 'Appointment Booking Successful',
                    html: `<p>Dear ${patient.name}, your appointment with Dr. ${doctor.name} is confirmed!</p>
                           <p>Appointment ID: ${appointment._id.toString()}</p>
                           <p>Date: ${appointment.date.toLocaleDateString()}</p>
                           <p>Time: ${appointment.timeSlot}</p>
                           <p>Payment ID: ${appointment.paymentID}</p>`
                });
                console.log(`Appointment ${appointment._id} successfully processed.`);
            } catch (err) {
                console.error('Blockchain/email error:', err);
                // Optionally mark appointment as failed in MongoDB
            } finally {
                // Release the lock
                processingOrders.delete(orderId);
            }
        });
        // Send response immediately after scheduling async work
        return res.status(200).json({ success: true, message: 'Webhook accepted' });
      }
      return res.status(200).json({ success: true, message: 'Webhook processed successfully'});
    } catch (error) {
        console.error('Webhook processing error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
app.get('/appointments/:id/status', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id).select('paymentStatus');
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, status: appointment.paymentStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// app.post('/book-appointment', async (req, res) => {
//   try {
//       const {
//           patientId,
//           doctorId,
//           date,
//           timeSlot,
//           reason,
//           symptoms = []
//       } = req.body;

//       // Validate required fields
//       if (!patientId || !doctorId || !date || !timeSlot || !reason) {
//           return res.status(400).json({
//               success: false,
//               message: 'Missing required fields: patientId, doctorId, date, timeSlot, reason'
//           });
//       }

//       // Fetch patient details
//       const patient = await Patient.findById(patientId).select('name username email');
//       if (!patient) {
//           return res.status(404).json({
//               success: false,
//               message: 'Patient not found'
//           });
//       }

//       // Fetch doctor details
//       const doctor = await Doctor.findById( doctorId ).select('name specialization username email');
//       if (!doctor) {
//           return res.status(404).json({
//               success: false,
//               message: 'Doctor not found'
//           });
//       }

//       // Check doctor availability for the slot
//       const availabilityResponse = await checkDoctorAvailability(doctorId, date, timeSlot);
//       if (!availabilityResponse.available) {
//           return res.status(400).json({
//               success: false,
//               message: 'Doctor not available for the selected slot',
//               details: availabilityResponse.reason
//           });
//       }

//       // Generate unique appointment ID
//       const appointmentId = `APT${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

//       // Create appointment
//       const appointment = new Appointment({
//           appointmentId,
//           patientId,
//           patientName: patient.name,
//           doctorId,
//           doctorName: doctor.name,
//           doctorSpecialization: doctor.specialization,
//           date: new Date(date),
//           timeSlot,
//           reason,
//           symptoms,
//           status: 'scheduled',
//           statusHistory: [{
//               status: 'scheduled',
//               timestamp: new Date(),
//               changedBy: 'patient'
//           }],
//           bookedAt: new Date()
//       });

//       // Save to database
//       await appointment.save();
//       appointment.id=appointment._id;

//       res.status(201).json({
//         success: true,
//         message: 'Appointment booked successfully',
//         data: appointment
//       });
//       setImmediate(async () => {
//         try {
//             const fb = new FabricClient(
//               './full-connection.json',
//               path.join(__dirname, 'wallet','PatientOrg'),
//               patient.username
//             );
//             await fb.initialize();
//             console.time("appoinement");
//             console.log("appoinement");
//             const tomorrow = new Date();
//             tomorrow.setDate(tomorrow.getDate() + 1);
//             const dateString = tomorrow.toISOString().split('T')[0]; // "2026-03-29"
//             await fb.createAppointment(appointment._id.toString(),patient._id.toString(),patient.name,doctorId,doctor.name,doctor.specialization,dateString,timeSlot,reason,symptoms,patient._id.toString(),doctor.hospital_name);
//             console.timeEnd("appoinement");
//             console.time("access");
//             console.log("access")
//             await fb.grantAccessForAppointment(patient._id.toString(), appointment._id.toString(),['peer0.platform.example.com', 'peer0.patients.example.com']);
//             console.timeEnd("access");
//             // 4. Send success email
//             await sendEmail({
//                 to: patient.email,
//                 cc:[doctor.email],
//                 subject: 'Appointment Booking Successfull',
//                 html: `<p>Dear ${patient.name} , your appoinemtn booking with doctor ${doctor.name} was successfull!</p>
//                        <p>Your Appoinment ID is ${appointment._id.toString()}`
//             });
//         } catch (error) {
//             console.log(error);
//         }
//       });
//   } catch (error) {
//       console.error('Error booking appointment:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Server error',
//           error: error.message
//       });
//   }
// });


app.post('/book-quick-appointment', async (req, res) => {
  try {
    const {
      patientName,
      patientAge,
      patientEmail,
      patientPhone,
      doctorId,
      date,
      timeSlot,
      reason,
      symptoms = []
    } = req.body;

    // Validate required fields
    if (!patientName || !patientAge || !patientEmail || !patientPhone || !doctorId || !date || !timeSlot || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: patientName, patientAge, patientEmail, patientPhone, doctorId, date, timeSlot, reason'
      });
    }

    // Fetch doctor details
    const doctor = await Doctor.findById(doctorId).select('name specialization username email consultationFee hospital_name hospital_id');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    if(doctor.hospital_id!=''){
      await Hospital.findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(doctor.hospital_id) },
          { $inc: { 'stats.totalAppointments': 1 } }
        );
    }
    // Check doctor availability for the slot
    const availabilityResponse = await checkDoctorAvailability(doctorId, date, timeSlot);
    if (!availabilityResponse.available) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not available for the selected slot',
        details: availabilityResponse.reason
      });
    }

    // Generate unique appointment ID
    const appointmentId = `APT${Date.now()}${Math.random().toString(36).substr(2, 9)}`;

    // Create local appointment document (MongoDB)
    const appointment = new Appointment({
      appointmentId,
      isGuest: true,
      patientName,
      guestDetails: {
        name: patientName,
        age: patientAge,
        email: patientEmail,
        phone: patientPhone
      },
      doctorId,
      doctorName: doctor.name,
      doctorSpecialization: doctor.specialization,
      date: new Date(date),
      timeSlot,
      reason,
      symptoms,
      status: 'scheduled',
      paymentStatus:'waiting',
      statusHistory: [{
        status: 'scheduled',
        timestamp: new Date(),
        changedBy: 'guest'
      }],
      bookedAt: new Date()
    });

    // Save to database first (to have an _id for the appointment)
    await appointment.save();

    // Prepare chaincode arguments
    const symptomsStr = JSON.stringify(symptoms);

    // Initialize Fabric client (using the doctor's organization – ProviderOrg or hospital)
    const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';
    const fb = new FabricClient(
      './full-connection.json',
      wallet,
      doctor.username
    );
    await fb.initialize();

    // Call chaincode to create quick appointment
    await fb.createQuickAppointment(
      appointment._id.toString(), // use MongoDB _id as appointmentId
      patientName,
      parseInt(patientAge),
      patientEmail,
      patientPhone,
      doctor._id.toString(), // doctorId in chaincode
      doctor.name,
      doctor.specialization,
      date,
      timeSlot,
      reason,
      symptomsStr,
      doctor.username, // createdBy (doctor)
      doctor.hospital_name
    );

    // Send confirmation emails (asynchronous, don't block response)
    setImmediate(async () => {
      try {
        await sendEmail({
          to: patientEmail,
          cc: [doctor.email],
          subject: 'Appointment Booking Confirmation',
          html: `<p>Dear ${patientName}, your appointment with Dr. ${doctor.name} on ${date} at ${timeSlot} has been booked successfully.</p>
                 <p>Your appointment reference: ${appointment._id}</p>
                 <p>Please arrive 10 minutes early.</p>`
        });
        console.log(`✓ Confirmation email sent for guest appointment ${appointment._id}`);
      } catch (emailError) {
        console.error(`Failed to send email for guest appointment ${appointment._id}:`, emailError.message);
      }
    });

    // Return success response immediately (email is sent in background)
    res.status(201).json({
      success: true,
      message: 'Quick appointment booked successfully',
      data: {
        appointmentId: appointment._id,
        patientName,
        doctorName: doctor.name,
        date,
        timeSlot,
        status: 'scheduled'
      }
    });

  } catch (error) {
    console.error('Error booking quick appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.post('/create-quick-payment-order', async (req, res) => {
  try {
    const { appointmentId, amount } = req.body;

    if (!appointmentId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid appointment ID and amount required' });
    }

    const appointment = await Appointment.findById(appointmentId).populate('doctorId');
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (appointment.paymentStatus !== 'waiting' ) {
      return res.status(400).json({ success: false, message: 'Appointment not pending payment' });
    }

    const doctor = appointment.doctorId;
    const cfOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Update appointment with amount and payment ID
    appointment.paymentAmount = amount;
    appointment.paymentStatus= 'pending';
    appointment.paymentID = cfOrderId;
    await appointment.save();

    // Create Cashfree order using PaymentService (your existing wrapper)
    const orderData = {
      order_id: cfOrderId,
      order_amount: amount,
      order_currency: 'INR',
      order_note: `Appointment with Dr. ${doctor.name}`,
      customer_details: {
        customer_id: appointment._id.toString(),
        customer_name: appointment.patientName,
        customer_email: appointment.guestDetails.email,
        customer_phone: `+91${appointment.guestDetails.phone}`,
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment-return?order_id=${cfOrderId}`,
        notify_url: `${process.env.WEBHOOK_URL}/quick-payment-webhook`
      }
    };

    const paymentResponse = await PaymentService.createOrderUrl(orderData);

    res.status(200).json({
      success: true,
      data: {
        payment_session_id: paymentResponse.payment_session_id,
        payment_link: paymentResponse.payment_link,
        cf_order_id: cfOrderId
      }
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({ success: false, message: 'Payment initiation failed' });
  }
});

app.post('/quick-payment-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const rawBody = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'];

    // Optional: use an in‑memory set for idempotency (or Redis/DB for production)
    if (idempotencyKey && processedKeys.has(idempotencyKey)) {
        console.log('Duplicate quick payment webhook (idempotency key):', idempotencyKey);
        return res.status(200).send('Duplicate webhook processed');
    }

    let orderId, paymentStatus, eventType;
    try {
        orderId = rawBody.data?.order?.order_id;
        paymentStatus = rawBody.data?.payment?.payment_status;
        eventType = rawBody.type;
    } catch (err) {
        console.error('Failed to parse webhook JSON:', err);
        return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }

    if (!orderId || !paymentStatus) {
        console.error('Missing order_id or payment_status in webhook');
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        // Only process successful payments
        if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' && paymentStatus === 'SUCCESS') {
            // Find the appointment by paymentID (which is the Cashfree order_id)
            const appointment = await Appointment.findOne({ paymentID: orderId }).populate('doctorId');
            if (!appointment) {
                console.error(`Appointment not found for order ${orderId}`);
                return res.status(404).json({ success: false, message: 'Appointment not found' });
            }

            // Ensure it's a guest appointment
            if (!appointment.isGuest) {
                console.error(`Order ${orderId} is not for a guest appointment`);
                return res.status(400).json({ success: false, message: 'Not a guest appointment' });
            }

            // Already processed? (status already 'completed')
            if (appointment.paymentStatus === 'completed'||appointment.paymentStatus==='cancelled') {
                console.log(`Guest appointment ${appointment._id} already scheduled. Ignoring duplicate.`);
                if (idempotencyKey) processedKeys.add(idempotencyKey);
                return res.status(200).json({ success: true, message: 'Already processed' });
            }

            // Prevent concurrent processing for the same order
            if (processingOrders.has(orderId)) {
                return res.status(200).json({ success: true, message: 'Already processing' });
            }
            processingOrders.add(orderId);
            if (idempotencyKey) processedKeys.add(idempotencyKey);

            // Update MongoDB status to 'scheduled'
            appointment.paymentStatus = 'completed';
            appointment.statusHistory.push({
              status: 'completed',
              timestamp: new Date(),
              changedBy: 'system',
              note: 'Payment successful'
            });
            await appointment.save();

            // Process blockchain update asynchronously (doesn't block response)
            setImmediate(async () => {
                try {
                    const doctor = appointment.doctorId;
                    const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';
                    const fb = new FabricClient(
                        './full-connection.json',
                        wallet,
                        doctor.username
                    );
                    await fb.initialize();
                    // Send confirmation email to guest
                    await sendEmail({
                        to: appointment.guestDetails.email,
                        cc: doctor.email,
                        subject: 'Appointment Booking Successful',
                        html: `<p>Dear ${appointment.patientName}, your appointment with Dr. ${doctor.name} is confirmed!</p>
                               <p>Appointment ID: ${appointment._id}</p>
                               <p>Date: ${new Date(appointment.date).toLocaleDateString()}</p>
                               <p>Time: ${appointment.timeSlot}</p>
                               <p>Payment ID: ${appointment.paymentID}</p>`
                    });

                    console.log(`Guest appointment ${appointment._id} fully processed.`);
                } catch (err) {
                    console.error('Blockchain/email error for guest appointment:', err);
                    // Optionally mark appointment with a failure flag
                } finally {
                    processingOrders.delete(orderId);
                }
            });

            // Respond immediately to Cashfree (200 OK)
            return res.status(200).json({ success: true, message: 'Webhook accepted' });
        }

        // For other event types (e.g., payment failed) we could handle if needed
        return res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error) {
        console.error('Quick payment webhook error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});
app.put('/appointments/:appointmentId/status', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, username } = req.body;

    console.log(appointmentId, status, username);

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const validStatuses = ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const appointment = await Appointment.findById(new mongoose.Types.ObjectId(appointmentId));
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Authorize doctor
    const doctor = await Doctor.findOne({ username });
    if (!doctor) {
      return res.status(403).json({ success: false, message: 'Doctor not found' });
    }
    if (appointment.doctorId !== doctor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this appointment' });
    }

    // Only fetch patient if not a guest appointment
    let patient = null;
    if (!appointment.isGuest && appointment.patientId) {
      patient = await Patient.findById(appointment.patientId);
    }

    // Update database
    const previousStatus = appointment.status;
    appointment.status = status;
    appointment.statusHistory.push({
      status: status,
      timestamp: new Date(),
      changedBy: 'doctor'
    });

    const now = new Date();
    switch (status) {
      case 'confirmed': appointment.confirmedAt = now; break;
      case 'checked-in': appointment.checkedInAt = now; break;
      case 'in-consultation': appointment.consultationStartAt = now; break;
      case 'completed': appointment.consultationEndAt = now; appointment.completedAt = now; break;
      case 'cancelled': appointment.cancelledAt = now; break;
    }

    const updatedAppointment = await appointment.save();

    // Update blockchain for terminal statuses
    if (['completed', 'cancelled', 'no-show'].includes(status)) {
      const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';
      try {
        const fb = new FabricClient('./full-connection.json', wallet, doctor.username);
        await fb.initialize();
        await fb.updateAppointmentStatus(appointmentId, status, doctor.hospital_name);
        console.log('✅ Appointment status updated on blockchain');
      } catch (blockchainError) {
        console.error('❌ Blockchain update failed:', blockchainError);
        // Continue even if blockchain fails – appointment status is already updated in DB
      }
    }

    res.json({
      success: true,
      message: `Appointment status updated from ${previousStatus} to ${status}`,
      data: {
        appointmentId: updatedAppointment.appointmentId,
        previousStatus,
        newStatus: updatedAppointment.status,
        updatedAt: updatedAppointment.updatedAt,
        statusHistory: updatedAppointment.statusHistory,
        blockchainUpdated: ['completed', 'cancelled', 'no-show'].includes(status)
      }
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});
app.put('/appointments/:appointmentId/consultation', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const {
      diagnosis,
      prescription,
      notes,
      followUpDate,
      testsRecommended,
      vitalSigns,
      doctorUsername
    } = req.body;

    if (!diagnosis) {
      return res.status(400).json({ success: false, message: 'Diagnosis is required' });
    }
    if (!doctorUsername) {
      return res.status(400).json({ success: false, message: 'Doctor username is required' });
    }

    const doctor = await Doctor.findOne({ username: doctorUsername }).select('hospital_name hospital_id username email');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Increment hospital stats only if hospital is associated and appointment is NOT guest (guest has no patient to link)
    if (doctor.hospital_id && doctor.hospital_id !== '' && !appointment.isGuest) {
      await Hospital.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(doctor.hospital_id) },
        { $inc: { 'stats.totalAppointments': 1 } }
      );
    }

    // Prepare consultation data
    const updateData = {
      'consultation.diagnosis': diagnosis,
      'consultation.notes': notes || '',
      'consultation.followUpDate': followUpDate ? new Date(followUpDate) : null,
      'consultation.testsRecommended': testsRecommended || [],
      'consultation.vitalSigns': vitalSigns || {},
      consultationEndAt: new Date(),
    };

    if (prescription && Array.isArray(prescription)) {
      updateData['consultation.prescription'] = prescription.map(med => ({
        medicine: med.medicine,
        dosage: med.dosage || '',
        frequency: med.frequency || '',
        duration: med.duration || ''
      }));
    }

    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appointmentId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // For registered patients, update their consultation history and appointment reference
    if (!appointment.isGuest && appointment.patientId) {
      await Patient.findOneAndUpdate(
        { _id: appointment.patientId },
        {
          $push: {
            consultationHistory: {
              consultationId: `consult_${Date.now()}`,
              appointmentId: appointmentId,
              doctorId: doctorUsername,
              doctorName: appointment.doctorName,
              date: new Date(),
              diagnosis: diagnosis,
              prescription: prescription || [],
              notes: notes || '',
              followUpDate: followUpDate ? new Date(followUpDate) : null,
              testsRecommended: testsRecommended || []
            }
          }
        }
      );

      await Patient.findOneAndUpdate(
        { _id: appointment.patientId, 'appointmentReferences.appointmentId': appointmentId },
        { $set: { 'appointmentReferences.$.status': 'completed' } }
      );
    }

    // Prepare blockchain data
    const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';
    const patientName = appointment.isGuest
      ? (appointment.guestDetails?.name || appointment.patientName)
      : (await Patient.findById(appointment.patientId))?.name || 'Guest';
    const patientEmail = appointment.isGuest
      ? appointment.guestDetails?.email
      : (await Patient.findById(appointment.patientId))?.email;

    // Asynchronous blockchain update
    setImmediate(async () => {
      try {
        const fb = new FabricClient('./full-connection.json', wallet, doctor.username);
        await fb.initialize();

        // Prepare data for chaincode
        const prescriptionList = prescription && Array.isArray(prescription) ? prescription : [];
        const vitalSignsObj = {
          bloodPressure: vitalSigns?.bloodPressure || '',
          heartRate: parseInt(vitalSigns?.heartRate, 10) || 0,
          temperature: parseFloat(vitalSigns?.temperature) || 0.0,
          weight: parseFloat(vitalSigns?.weight) || 0.0,
          spo2: parseInt(vitalSigns?.spo2, 10) || 0
        };
        const testsArray = testsRecommended && Array.isArray(testsRecommended) ? testsRecommended : [];

        await fb.createConsultation(
          appointmentId,
          diagnosis,
          prescriptionList,
          notes || '',
          followUpDate || '',
          testsArray,
          vitalSignsObj,
          appointment.doctorId,
          doctor.hospital_name || ''
        );

        // Send email only if email is available
        if (patientEmail) {
          await sendEmail({
            to: patientEmail,
            cc: [doctor.email],
            subject: 'Consultation Recorded',
            html: `<p>Dear ${patientName}, your consultation with Dr. ${doctor.name} has been recorded.</p>
                   <p>Diagnosis: ${diagnosis}</p>
                   <p>Follow-up: ${followUpDate || 'None'}</p>`
          });
        }

        console.log(`✅ Consultation recorded on blockchain for appointment ${appointmentId}`);
      } catch (error) {
        console.error(`❌ Blockchain consultation recording failed for appointment ${appointmentId}:`, error.message);
        await Appointment.findByIdAndUpdate(appointmentId, {
          $set: { blockchainStatus: 'failed', blockchainError: error.message }
        });
        if (patientEmail) {
          await sendEmail({
            to: patientEmail,
            subject: 'Consultation Recording Issue',
            html: `<p>Dear ${patientName}, there was a problem recording your consultation. Please contact support.</p>`
          });
        }
      }
    });

    res.json({
      success: true,
      message: 'Consultation details saved successfully',
      data: {
        appointment: {
          appointmentId: updatedAppointment._id,
          patientName: updatedAppointment.patientName,
          doctorName: updatedAppointment.doctorName,
          date: updatedAppointment.date,
          diagnosis: updatedAppointment.consultation.diagnosis,
          status: updatedAppointment.status,
          completedAt: updatedAppointment.completedAt
        },
        consultation: {
          diagnosis: updatedAppointment.consultation.diagnosis,
          prescription: updatedAppointment.consultation.prescription,
          notes: updatedAppointment.consultation.notes,
          followUpDate: updatedAppointment.consultation.followUpDate,
          testsRecommended: updatedAppointment.consultation.testsRecommended,
          vitalSigns: updatedAppointment.consultation.vitalSigns
        }
      }
    });

  } catch (error) {
    console.error('Error saving consultation details:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ success: false, message: 'Validation error', errors });
    }
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});
// app.put('/appointments/:appointmentId/status', async (req, res) => {
//   try {
//       const { appointmentId } = req.params;
//       const { status } = req.body;
//       const { username } = req.body; 

//       console.log(appointmentId, status, username);
      
//       // Validate input
//       if (!status) {
//           return res.status(400).json({
//               success: false,
//               message: 'Status is required'
//           });
//       }

//       // Validate status enum
//       const validStatuses = ['scheduled', 'confirmed', 'checked-in', 'in-consultation', 'completed', 'cancelled', 'no-show'];
//       if (!validStatuses.includes(status)) {
//           return res.status(400).json({
//               success: false,
//               message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
//           });
//       }

//       // Find appointment
//       console.log(appointmentId);
//       const appointment = await Appointment.findById(new mongoose.Types.ObjectId(appointmentId));
//       console.log(appointment);
      
//       if (!appointment) {
//           return res.status(404).json({
//               success: false,
//               message: 'Appointment not found'
//           });
//       }

//       // Verify the doctor is authorized to update this appointment
//       const doctor = await Doctor.findOne({ username });
//       if (!doctor) {
//           return res.status(403).json({
//               success: false,
//               message: 'Doctor not found'
//           });
//       }
      
//       console.log(appointment.doctorId, doctor._id);
      
//       if (appointment.doctorId !== doctor._id.toString()) {
//           return res.status(403).json({
//               success: false,
//               message: 'Not authorized to update this appointment'
//           });
//       }

//       // Get patient and doctor usernames for blockchain
//       const patient = await Patient.findById(appointment.patientId);
//       if (!patient) {
//           return res.status(404).json({
//               success: false,
//               message: 'Patient not found'
//           });
//       }

//       // const today = new Date().toISOString().split('T')[0];
//       // const appointmentDate = new Date(appointment.date).toISOString().split('T')[0];
      
//       // if (appointmentDate !== today) {
//       //     return res.status(400).json({
//       //         success: false,
//       //         message: `Cannot update status. Appointment date is ${appointmentDate}, today is ${today}`
//       //     });
//       // }

//       // Update database
//       const previousStatus = appointment.status;
//       appointment.status = status;

//       // Update status history
//       appointment.statusHistory.push({
//           status: status,
//           timestamp: new Date(),
//           changedBy: 'doctor'
//       });

//       // Update timestamps based on status
//       const now = new Date();
//       switch (status) {
//           case 'confirmed':
//               appointment.confirmedAt = now;
//               break;
//           case 'checked-in':
//               appointment.checkedInAt = now;
//               break;
//           case 'in-consultation':
//               appointment.consultationStartAt = now;
//               break;
//           case 'completed':
//               appointment.consultationEndAt = now;
//               appointment.completedAt = now;
//               break;
//           case 'cancelled':
//               appointment.cancelledAt = now;
//               break;
//       }

//       // Save updated appointment
//       const updatedAppointment = await appointment.save();    
//       const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';
//       // Update blockchain for completed, cancelled, and no-show statuses
//       if (status === 'completed' || status === 'cancelled' || status === 'no-show') {
//         try {
//           const fb = new FabricClient(
//             './full-connection.json',
//             path.join(__dirname, 'wallet',orgName),
//             doctor.username
//           );
//           await fb.initialize();
//           await fb.updateAppointmentStatus(appointmentId, status,doctor.hospital_name);
//           console.log('✅ Appointment status updated on blockchain');
//         } catch (blockchainError) {
//             console.error('❌ Blockchain update failed:', blockchainError);
//             return res.status(500).json({
//                 success: false,
//                 message: 'Failed to update appointment on blockchain',
//                 error: blockchainError.message
//             });
//         }
//       }

//       res.json({
//           success: true,
//           message: `Appointment status updated from ${previousStatus} to ${status}`,
//           data: {
//             appointmentId: updatedAppointment.appointmentId,
//             previousStatus,
//             newStatus: updatedAppointment.status,
//             updatedAt: updatedAppointment.updatedAt,
//             statusHistory: updatedAppointment.statusHistory,
//             blockchainUpdated: (status === 'completed' || status === 'cancelled' || status === 'no-show')
//           }
//       });

//   } catch (error) {
//       console.error('Error updating appointment status:', error);
//       res.status(500).json({
//           success: false,
//           message: 'Server error while updating appointment status',
//           error: error.message
//       });
//   }
// });
// app.put('/appointments/:appointmentId/consultation', async (req, res) => {
//   try {
//     const { appointmentId } = req.params;
//     const { 
//       diagnosis,
//       prescription,
//       notes,
//       followUpDate,
//       testsRecommended,
//       vitalSigns,
//       doctorUsername 
//     } = req.body;

//     // Validate required fields
//     if (!diagnosis) {
//       return res.status(400).json({
//         success: false,
//         message: 'Diagnosis is required'
//       });
//     }
    
//     if (!doctorUsername) {
//       return res.status(400).json({
//         success: false,
//         message: 'Doctor username is required'
//       });
//     }
//     const doctor = await Doctor.findOne({username:doctorUsername}).select('hospital_name hospital_id');
//     if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
//     if(doctor.hospital_id!=''){
//       await Hospital.findOneAndUpdate(
//           { _id: new mongoose.Types.ObjectId(doctor.hospital_id) },
//           { $inc: { 'stats.totalAppointments': 1 } }
//         );
//     }

//     // Get appointment
//     const appointment = await Appointment.findById(appointmentId);
//     if (!appointment) {
//       return res.status(404).json({
//         success: false,
//         message: 'Appointment not found'
//       });
//     }
    
//     // Check if appointment status is completed, cancelled, or no-show
//     // const terminalStatuses = ['completed', 'cancelled', 'no-show'];
//     // if (terminalStatuses.includes(appointment.status)) {
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: `Cannot perform action. Appointment is already ${appointment.status}.`
//     //   });
//     // }
//     // Update consultation details
//     const updateData = {
//       'consultation.diagnosis': diagnosis,
//       'consultation.notes': notes || '',
//       'consultation.followUpDate': followUpDate ? new Date(followUpDate) : null,
//       'consultation.testsRecommended': testsRecommended || [],
//       'consultation.vitalSigns': vitalSigns || {},
//       consultationEndAt: new Date(),
//     };

//     // Add prescription if provided
//     if (prescription && Array.isArray(prescription)) {
//       updateData['consultation.prescription'] = prescription.map(med => ({
//         medicine: med.medicine,
//         dosage: med.dosage || '',
//         frequency: med.frequency || '',
//         duration: med.duration || ''
//       }));
//     }

//     // Add vital signs with validation
//     if (vitalSigns) {
//       updateData['consultation.vitalSigns'] = {
//         bloodPressure: vitalSigns.bloodPressure || '',
//         heartRate: vitalSigns.heartRate || null,
//         temperature: vitalSigns.temperature || null,
//         weight: vitalSigns.weight || null,
//         spo2: vitalSigns.spo2 || null
//       };
//     }

//     // Update appointment with consultation details
//     const updatedAppointment = await Appointment.findOneAndUpdate(
//       { _id:appointmentId },
//       { 
//         $set: updateData
//       },
//       { 
//         new: true,
//         runValidators: true 
//       }
//     ).populate('patientId', 'name phoneNo bloodGroup allergies chronicConditions');

//     // Update patient's appointment reference status
//     await Patient.findOneAndUpdate(
//       { 
//         username: appointment.patientId,
//         'appointmentReferences.appointmentId': appointmentId
//       },
//       {
//         $set: {
//           'appointmentReferences.$.status': 'completed'
//         }
//       }
//     );

//     // Add to patient's consultation history
//     await Patient.findOneAndUpdate(
//       { username: appointment.patientId },
//       {
//         $push: {
//           consultationHistory: {
//             consultationId: `consult_${Date.now()}`,
//             appointmentId: appointmentId,
//             doctorId: doctorUsername,
//             doctorName: appointment.doctorName,
//             date: new Date(),
//             diagnosis: diagnosis,
//             prescription: prescription || [],
//             notes: notes || '',
//             followUpDate: followUpDate ? new Date(followUpDate) : null,
//             testsRecommended: testsRecommended || []
//           }
//         }
//       }
//     );


//     res.json({
//       success: true,
//       message: 'Consultation details saved successfully',
//       data: {
//         appointment: {
//           appointmentId: updatedAppointment._id,
//           patientName: updatedAppointment.patientName,
//           doctorName: updatedAppointment.doctorName,
//           date: updatedAppointment.date,
//           diagnosis: updatedAppointment.consultation.diagnosis,
//           status: updatedAppointment.status,
//           completedAt: updatedAppointment.completedAt
//         },
//         consultation: {
//           diagnosis: updatedAppointment.consultation.diagnosis,
//           prescription: updatedAppointment.consultation.prescription,
//           notes: updatedAppointment.consultation.notes,
//           followUpDate: updatedAppointment.consultation.followUpDate,
//           testsRecommended: updatedAppointment.consultation.testsRecommended,
//           vitalSigns: updatedAppointment.consultation.vitalSigns
//         }
//       }
//     });

//     setImmediate(async () => {
//       try {
//         // The doctor may be under ProviderOrg or a hospital-specific org
//         const doctor = await Doctor.findById(new mongoose.Types.ObjectId(appointment.doctorId)).select('username email hospital_name');
//         const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';
//         const patient = await Patient.findById(new mongoose.Types.ObjectId(appointment.patientId)).select('username email hospital_name');
//         console.log(patient)
//         console.log(doctor)
//         const fb = new FabricClient(
//           './full-connection.json',
//           path.join(__dirname, 'wallet', orgName),
//           doctor.username
//         );
//         console.log(req.body)
//         await fb.initialize();
//         await fb.updateAppointmentStatus(appointmentId, 'completed',doctor.hospital_name);
//         console.log('✅ Appointment status updated on blockchain');
    
//         // Prepare prescription array (already correct)
//         let prescriptionList = [];
//         if (prescription) {
//             const prescriptionsArray = Array.isArray(prescription) ? prescription : [prescription];
//             prescriptionList = prescriptionsArray.map(med => ({
//                 medicine: med.medicine,
//                 dosage: med.dosage || '',
//                 frequency: med.frequency || '',
//                 duration: med.duration || ''
//             }));
//         }        
//         // Prepare vital signs object
//         const vitalSignsObj = {
//           bloodPressure: vitalSigns?.bloodPressure || '',
//           heartRate: parseInt(vitalSigns?.heartRate, 10) || 0,
//           temperature: parseFloat(vitalSigns?.temperature) || 0.0,
//           weight: parseFloat(vitalSigns?.weight) || 0.0,
//           spo2: parseInt(vitalSigns?.spo2, 10) || 0
//         };
//         const testsArray = Array.isArray(testsRecommended) ? testsRecommended : (testsRecommended ? [testsRecommended] : []);
        
//         // Call chaincode – pass objects directly, no stringify
//         await fb.createConsultation(
//           appointmentId,
//           diagnosis,
//           prescriptionList,          // array of objects
//           notes || '',
//           followUpDate || '',
//           testsArray,    // array of strings
//           vitalSignsObj,             // object
//           appointment.doctorId,
//           doctor.hospital_name != '' ? doctor.hospital_name : ''
//         );        
//         console.timeEnd('CreateConsultation');
    
//         // Send email notification
//         await sendEmail({
//           to: patient.email,
//           cc: [doctor.email],
//           subject: 'Consultation Recorded',
//           html: `<p>Dear ${patient.name}, your consultation with Dr. ${doctor.name} has been recorded.</p>
//                  <p>Diagnosis: ${diagnosis}</p>
//                  <p>Follow-up: ${followUpDate || 'None'}</p>`
//         });
    
//         console.log(`✅ Consultation recorded on blockchain for appointment ${appointmentId}`);
    
//       } catch (error) {
//         console.error(`❌ Blockchain consultation recording failed for appointment ${appointmentId}:`, error.message);
//         // Optionally update appointment with a failed flag
//         await Appointment.findByIdAndUpdate(appointmentId, {
//           $set: { blockchainStatus: 'failed', blockchainError: error.message }
//         });
//         // Send failure email
//         await sendEmail({
//           to: appointment.patientId.email,
//           subject: 'Consultation Recording Issue',
//           html: `<p>Dear ${appointment.patientId.name}, there was a problem recording your consultation. Please contact support.</p>`
//         });
//       }
//     });
//     } catch (error) {
//     console.error('Error saving consultation details:', error);
    
//     if (error.name === 'ValidationError') {
//       const errors = Object.values(error.errors).map(err => err.message);
//       return res.status(400).json({
//         success: false,
//         message: 'Validation error',
//         errors
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: 'Server error',
//       error: error.message
//     });
//   }
// });

app.put('/appointments/:appointmentId/guest-consultation', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { 
      diagnosis,
      prescription,
      notes,
      followUpDate,
      testsRecommended,
      vitalSigns,
      doctorUsername 
    } = req.body;

    // Validate required fields
    if (!diagnosis) {
      return res.status(400).json({ success: false, message: 'Diagnosis is required' });
    }
    if (!doctorUsername) {
      return res.status(400).json({ success: false, message: 'Doctor username is required' });
    }

    // Fetch appointment – must be a guest appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    if (!appointment.isGuest) {
      return res.status(400).json({ success: false, message: 'This endpoint is only for guest appointments' });
    }
    if (!appointment.guestDetails || !appointment.guestDetails.email) {
      return res.status(400).json({ success: false, message: 'Guest email missing' });
    }

    // Check terminal statuses
    const terminalStatuses = ['completed', 'cancelled', 'no-show'];
    if (terminalStatuses.includes(appointment.status)) {
      return res.status(400).json({ success: false, message: `Cannot perform action. Appointment is already ${appointment.status}.` });
    }

    // Get doctor details (for email)
    const doctor = await Doctor.findOne({ username: doctorUsername }).select('email hospital_name');
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Build update data
    const updateData = {
      'consultation.diagnosis': diagnosis,
      'consultation.notes': notes || '',
      'consultation.followUpDate': followUpDate ? new Date(followUpDate) : null,
      'consultation.testsRecommended': testsRecommended || [],
      'consultation.vitalSigns': {
        bloodPressure: vitalSigns?.bloodPressure || '',
        heartRate: vitalSigns?.heartRate || null,
        temperature: vitalSigns?.temperature || null,
        weight: vitalSigns?.weight || null,
        spo2: vitalSigns?.spo2 || null
      },
      consultationEndAt: new Date(),
      status: 'completed',
      completedAt: new Date(),
      statusHistory: [
        ...appointment.statusHistory,
        { status: 'completed', timestamp: new Date(), changedBy: 'doctor' }
      ]
    };

    // Add prescription if provided
    if (prescription && Array.isArray(prescription) && prescription.length > 0) {
      updateData['consultation.prescription'] = prescription.map(med => ({
        medicine: med.medicine,
        dosage: med.dosage || '',
        frequency: med.frequency || '',
        duration: med.duration || ''
      }));
    }

    // Update the appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Respond immediately
    res.json({
      success: true,
      message: 'Consultation recorded successfully for guest appointment',
      data: {
        appointmentId: updatedAppointment._id,
        patientName: updatedAppointment.patientName,
        doctorName: updatedAppointment.doctorName,
        date: updatedAppointment.date,
        status: updatedAppointment.status,
        consultation: updatedAppointment.consultation
      }
    });

    // --- Background tasks (no patient record updates) ---
    setImmediate(async () => {
      try {
        // Determine organization (doctor's org)
        const orgName = doctor.hospital_name && doctor.hospital_name !== '' ? doctor.hospital_name : 'ProviderOrg';

        const fb = new FabricClient(
          './full-connection.json',
          wallet,
          doctorUsername
        );
        await fb.initialize();

        // Prepare data for chaincode
        const prescriptionList = (prescription || []).map(med => ({
          medicine: med.medicine,
          dosage: med.dosage || '',
          frequency: med.frequency || '',
          duration: med.duration || ''
        }));

        const vitalSignsObj = {
          bloodPressure: vitalSigns?.bloodPressure || '',
          heartRate: vitalSigns?.heartRate || 0,
          temperature: vitalSigns?.temperature || 0.0,
          weight: vitalSigns?.weight || 0.0,
          spo2: vitalSigns?.spo2 || 0
        };

        // Record on blockchain
        console.time('CreateConsultation');
        await fb.createConsultation(
          appointmentId,
          diagnosis,
          JSON.stringify(prescriptionList),
          notes || '',
          followUpDate || '',
          JSON.stringify(testsRecommended || []),
          JSON.stringify(vitalSignsObj),
          appointment.doctorId,
          doctor.hospital_name!=''?doctor.hospital_name:'' // doctorID in chaincode (the ID, not username)
        );
        console.timeEnd('CreateConsultation');

        // Send email to guest
        await sendEmail({
          to: appointment.guestDetails.email,
          cc: [doctor.email],
          subject: 'Consultation Recorded',
          html: `<p>Dear ${appointment.patientName},</p>
                 <p>Your consultation with Dr. ${appointment.doctorName} on ${new Date(appointment.date).toLocaleDateString()} has been recorded.</p>
                 <p><strong>Diagnosis:</strong> ${diagnosis}</p>
                 <p><strong>Follow-up:</strong> ${followUpDate || 'None'}</p>
                 <p>If you have any questions, please contact the clinic.</p>`
        });

        console.log(`✅ Guest consultation recorded on blockchain for appointment ${appointmentId}`);
      } catch (error) {
        console.error(`❌ Blockchain guest consultation failed for appointment ${appointmentId}:`, error.message);
        // Optionally update appointment with a failed flag
        await Appointment.findByIdAndUpdate(appointmentId, {
          $set: { blockchainStatus: 'failed', blockchainError: error.message }
        });
        // Send failure email
        await sendEmail({
          to: appointment.guestDetails.email,
          subject: 'Consultation Recording Issue',
          html: `<p>Dear ${appointment.patientName}, there was a problem recording your consultation. Please contact support.</p>`
        });
      }
    });

  } catch (error) {
    console.error('Error recording guest consultation:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

app.get('/doctors/patients/:patientUsername/medical-history', async (req, res) => {
  try {
    const { patientUsername } = req.params;
    const { doctorUsername, appointmentId } = req.query; // Get appointmentId for access verification

    if (!doctorUsername) {
      return res.status(400).json({
        success: false,
        message: 'Doctor username is required'
      });
    }

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required for access verification'
      });
    }

    // Get patient basic info
    const patient = await Patient.findOne({ username: patientUsername })
      .select('name dateOfBirth gender bloodGroup profilePhoto allergies chronicConditions _id');

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get doctor info
    const doctor = await Doctor.findOne({ username: doctorUsername })
      .select('name _id hospital_name ');

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // ✅ FIX: Check if this appointment exists and doctor is assigned to it
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: patient._id.toString(),
      doctorId: doctor._id.toString()
    });

    if (!appointment) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No valid appointment found for this patient-doctor combination'
      });
    }
    const orgName = doctor.hospital_name != '' ? doctor.hospital_name : 'ProviderOrg';
    console.log(doctor)
    const fb = new FabricClient(
      './full-connection.json',
      wallet,
      doctorUsername
    );
    await fb.initialize();

    // ✅ FIX: Check access using the appointment
    const hasAccess = await fb.checkDoctorAccess(patient._id.toString(),doctor._id.toString());
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: No permission to view this patient\'s medical history'
      });
    }

    // ✅ FIX: Use doctor._id for queries
    const doctorConsultations = await Appointment.find({
      patientId: patient._id.toString(),
      doctorId: doctor._id.toString(), // Use doctor._id instead of doctorUsername
      status: 'completed',
      'consultation.diagnosis': { $exists: true, $ne: null }
    })
    .sort({ date: -1 })
    .select('date consultation symptoms reason status');

    // Get latest vital signs from all consultations
    const latestVitals = await Appointment.findOne({
      patientId: patient._id.toString(),
      status: 'completed',
      'consultation.vitalSigns': { $exists: true, $ne: null }
    })
    .sort({ completedAt: -1 })
    .select('consultation.vitalSigns date doctorName');

    // Get complete consultation history (last 20)
    const consultationHistory = await Appointment.find({
      patientId: patient._id.toString(),
      status: 'completed',
      'consultation.diagnosis': { $exists: true, $ne: null }
    })
    .sort({ completedAt: -1 })
    .limit(20)
    .select('date doctorName doctorSpecialization consultation symptoms reason prescription notes vitalSigns');

    const fb2 = new FabricClient(
      './full-connection.json',
      wallet,
      'work'
    );
    await fb2.initialize();

    const privateDetails = await fb2.getPatientPrivateDetails(patient._id.toString(), '');

    // Build medicalProfile from blockchain data
    const medicalProfile = {
      allergies: privateDetails.allergies || [],
      chronicConditions: privateDetails.chronicConditions || [],
      currentMedications: privateDetails.currentMedications || [],
      medicalHistory: privateDetails.medicalHistory || '',
      familyHistory: privateDetails.familyHistory || '',
      surgicalHistory: privateDetails.surgicalHistory || [],
      physicalStats: {
        weight: privateDetails.weight,
        height: privateDetails.height,
        bmi: privateDetails.bmi
      }
    };

    // Get appointment statistics
    const appointmentStats = await Appointment.aggregate([
      { $match: { patientId: patient._id.toString() } },
      { $group: { 
        _id: '$status', 
        count: { $sum: 1 } 
      }}
    ]);

    // Format the response
    const medicalHistory = {
      patientInfo: {
        name: patient.name,
        age: patient.age, // Virtual property
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        profilePhoto: patient.profilePhoto
      },
      medicalProfile, 
      latestVitals: latestVitals ? {
        date: latestVitals.date,
        ...latestVitals.consultation.vitalSigns
      } : null,
      doctorSpecific: {
        totalConsultations: doctorConsultations.length,
        consultations: doctorConsultations.map(consult => ({
          date: consult.date,
          reason: consult.reason,
          symptoms: consult.symptoms,
          diagnosis: consult.consultation.diagnosis,
          status: consult.status
        }))
      },
      completeHistory: {
        totalConsultations: consultationHistory.length,
        consultations: consultationHistory.map(consult => ({
          date: consult.date,
          specialization: consult.doctorSpecialization,
          reason: consult.reason,
          symptoms: consult.symptoms,
          diagnosis: consult.consultation.diagnosis,
          prescription: consult.consultation.prescription,
          notes: consult.consultation.notes,
          vitalSigns: consult.consultation.vitalSigns
        }))
      },
      statistics: {
        totalAppointments: appointmentStats.reduce((sum, stat) => sum + stat.count, 0),
        completed: appointmentStats.find(stat => stat._id === 'completed')?.count || 0,
        byStatus: appointmentStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      },
      currentAppointment: {
        appointmentId: appointment.appointmentId,
        date: appointment.date,
        timeSlot: appointment.timeSlot,
        reason: appointment.reason,
        status: appointment.status
      }
    };

    // Log access for audit
    console.log(`🔍 Doctor ${doctorUsername} accessed medical history of patient ${patientUsername} via appointment ${appointmentId}`);

    res.json({
      success: true,
      data: medicalHistory
    });

  } catch (error) {
    console.error('Error fetching patient medical history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

app.get('/appointments/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { username } = req.query; // could be patient username, doctor username, or hospital email

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username/email is required'
      });
    }

    // Determine user type
    let user = await Doctor.findOne({ username });
    let userType = 'doctor';
    let hospital = null;

    if (!user) {
      user = await Patient.findOne({ username });
      userType = 'patient';
      if (!user) {
        // Try to find hospital by email (since hospital login uses email)
        user = await Hospital.findOne({ email: username });
        if (user) {
          userType = 'hospital';
          hospital = user; // store hospital object for later
        } else {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
      }
    }

    // Fetch appointment with populated doctor and patient
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'patientId username name email phoneNo dateOfBirth gender bloodGroup address')
      .populate('doctorId', 'doctorId username name email phoneNo specialization registrationNumber address hospital_id') // include hospital_id
      .lean();

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // Authorization
    if (userType === 'patient') {
      // Patient can only view their own appointments
      if (appointment.isGuest) {
        // Guest appointments are not linked to a patientId, so they shouldn't be accessed by registered patients
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
      // For registered patient, check patientId matches the user's ID
      if (appointment.patientId && appointment.patientId._id.toString() !== user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
    } else if (userType === 'doctor') {
      // Doctor can view only their own appointments
      if (appointment.doctorId && appointment.doctorId._id.toString() !== user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
    } else if (userType === 'hospital') {
      // Hospital can view appointments of doctors belonging to this hospital
      if (!appointment.doctorId || !appointment.doctorId.hospital_id) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
      // Compare hospital_id with hospital._id
      if (appointment.doctorId.hospital_id.toString() !== hospital._id.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied.' });
      }
    }

    // Build patient info (handles guest)
    let patientInfo = null;
    if (appointment.isGuest) {
      patientInfo = {
        isGuest: true,
        name: appointment.patientName,
        age: appointment.guestDetails?.age,
        email: appointment.guestDetails?.email,
        phone: appointment.guestDetails?.phone,
      };
    } else if (appointment.patientId) {
      const p = appointment.patientId;
      patientInfo = {
        isGuest: false,
        patientId: p.patientId,
        username: p.username,
        name: p.name,
        email: p.email,
        phoneNo: p.phoneNo,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        bloodGroup: p.bloodGroup,
        address: p.address,
        age: p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : null
      };
    }

    // Build doctor info
    const doctorInfo = appointment.doctorId ? {
      doctorId: appointment.doctorId.doctorId,
      username: appointment.doctorId.username,
      name: appointment.doctorId.name,
      email: appointment.doctorId.email,
      phoneNo: appointment.doctorId.phoneNo,
      specialization: appointment.doctorId.specialization,
      registrationNumber: appointment.doctorId.registrationNumber,
      address: appointment.doctorId.address
    } : null;

    const response = {
      success: true,
      data: {
        appointment: {
          appointmentId: appointment._id,
          date: appointment.date,
          timeSlot: appointment.timeSlot,
          slotDuration: appointment.slotDuration,
          status: appointment.status,
          isGuest: appointment.isGuest || false,

          patient: patientInfo,
          doctor: doctorInfo,

          reason: appointment.reason,
          symptoms: appointment.symptoms,
          statusHistory: appointment.statusHistory,
          consultation: appointment.consultation || {},
          accessPermissions: appointment.accessPermissions,
          bookedAt: appointment.bookedAt,
          confirmedAt: appointment.confirmedAt,
          checkedInAt: appointment.checkedInAt,
          consultationStartAt: appointment.consultationStartAt,
          consultationEndAt: appointment.consultationEndAt,
          completedAt: appointment.completedAt,
          cancelledAt: appointment.cancelledAt,
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({ success: false, error: 'Server error: ' + error.message });
  }
});
app.get('/verifyaccess/:appointmentId', async (req, res) => {
  try {
      const { appointmentId } = req.params;
      const { username } = req.query; 

      if (!username) {
          return res.status(400).json({
              success: false,
              error: 'Username is required'
          });
      }

      const result = await service.verifyAccess(appointmentId, username);
      console.log(result);
      if (result.success) {
          res.json({
              success: true,
              appointment: result.appointment
          });
      } else {
          if (result.notFound) {
              return res.status(404).json({
                  success: false,
                  error: 'Appointment not found on blockchain'
              });
          }
          res.status(500).json({
              success: false,
              error: result.error
          });
      }

  } catch (error) {
      console.error('Error fetching appointment:', error);
      res.status(500).json({
          success: false,
          error: 'Server error: ' + error.message
      });
  }
});

// Helper function to check doctor availability
async function checkDoctorAvailability(doctorId, date, timeSlot) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const doctor = await Doctor.findById(doctorId)
    .select('blockedSlots weeklySchedule scheduleOverrides');

  // 1. Check blocked slots
  const targetDateStr = targetDate.toISOString().split('T')[0];
  const isBlocked = doctor.blockedSlots.some(blocked => {
    const blockedDate = new Date(blocked.date).toISOString().split('T')[0];
    return blockedDate === targetDateStr && blocked.timeSlot === timeSlot;
  });
  if (isBlocked) {
    return { available: false, reason: 'Slot is blocked by doctor' };
  }

  // 2. Check schedule override
  const override = doctor.scheduleOverrides.find(ov => {
    const ovDate = new Date(ov.date).toISOString().split('T')[0];
    return ovDate === targetDateStr;
  });

  let isWorking = false;
  let slots = [];

  if (override) {
    isWorking = override.isWorking;
    if (isWorking && override.slots && override.slots.length) {
      slots = override.slots;
    }
  } else {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[targetDate.getDay()];
    const daySchedule = doctor.weeklySchedule.find(s => s.day === dayName);
    if (daySchedule) {
      isWorking = daySchedule.isWorking;
      if (isWorking && daySchedule.slots && daySchedule.slots.length) {
        slots = daySchedule.slots;
      }
    }
  }

  if (!isWorking) {
    return { available: false, reason: 'Doctor is not working on this day' };
  }

  const slotDef = slots.find(slot => `${slot.startTime}-${slot.endTime}` === timeSlot);
  if (!slotDef) {
    return { available: false, reason: 'Time slot not available in schedule' };
  }

  const maxPatients = slotDef.maxPatients || 1;

  const existingCount = await Appointment.countDocuments({
    doctorId,
    date: {
      $gte: targetDate,
      $lt: nextDate
    },
    timeSlot,
    status: { $in: ['scheduled', 'confirmed', 'checked-in'] }
  });

  if (existingCount >= maxPatients) {
    return { available: false, reason: `Slot is fully booked (${existingCount}/${maxPatients})` };
  }

  return { available: true };
}

app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'User Registration API',
        timestamp: new Date().toISOString(),
    });
});

app.get('/test-resend', async (req, res) => {
  try {
    const result = await sendEmail({
      to: 'soham56kadam@gmail.com',  // change to your real email
      subject: 'Test from Render',
      html: '<strong>Resend works on Render!</strong>'
    });
    res.send(`Email sent: ${result.id}`);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.use((error, req, res, next) => {
    console.error('🚨 Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

app.listen(3000, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${3000}`);
});