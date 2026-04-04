/*
 * SPDX-License-Identifier: Apache-2.0
 * UserRegistrationClient.js – Reusable class for Fabric CA user registration
 */

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const path = require('path');

class UserRegistrationClient {
    /**
     * Creates a new client instance.
     * @param {string} orgName - Name of the organization.
     * @param {string} [walletBasePath='./wallet'] - Base directory for wallets.
     * @param {object} [extraOrgConfigs={}] - Additional organization configs to merge.
     */
    constructor(orgName, wallet = null, extraOrgConfigs = {}) {
        this.orgName = orgName;
        this.wallet = wallet || new MongoWallet();
        this.orgConfigs = {
            ...this._getBuiltInConfigs(),
            ...extraOrgConfigs
        };
        this.orgConfig = this.orgConfigs[orgName];
        if (!this.orgConfig) {
            throw new Error(`Unknown organization: ${orgName}. Use addOrgConfig() to add it.`);
        }
        this.ca = null;
    }

    /**
     * Built‑in organization configurations.
     * @private
     */
    _getBuiltInConfigs() {
        return {
            'PlatformOrg': {
                mspId: 'PlatformOrgMSP',
                caUrl: 'https://20.198.76.230:8054',
                caName: 'ca-platform',
                domain: 'platform.example.com',
                affiliation: 'platform',
                adminId: 'admin-platform',
                adminSecret: 'adminpw'
            },
            'PatientOrg': {
                mspId: 'PatientOrgMSP',
                caUrl: 'https://20.198.76.230:9054',
                caName: 'ca-patients',
                domain: 'patients.example.com',
                affiliation: 'patients',
                adminId: 'admin-patients',
                adminSecret: 'adminpw'
            },
            'ProviderOrg': {
                mspId: 'HealthcareProviderOrgMSP',
                caUrl: 'https://20.198.76.230:10054',
                caName: 'ca-provider',
                domain: 'provider.example.com',
                affiliation: 'provider',
                adminId: 'admin-provider',
                adminSecret: 'adminpw'
            },
            'citygeneral': {
                mspId: 'citygeneralMSP',
                caUrl: 'https://20.198.76.230:12054',
                caName: 'ca-citygeneral',
                domain: 'citygeneral.example.com',
                affiliation: 'citygeneral',
                adminId: 'admin-citygeneral',
                adminSecret: 'adminpw'
            }
        };
    }

    /**
     * Adds or updates an organization configuration at runtime.
     * @param {string} orgName - Organization name (key).
     * @param {object} config - Configuration object (must contain mspId, caUrl, caName, domain, affiliation, adminId, adminSecret).
     */
    addOrgConfig(orgName, config) {
        this.orgConfigs[orgName] = config;
        if (orgName === this.orgName) {
            this.orgConfig = config; // update current if it's the same org
        }
        console.log(`Added configuration for organization: ${orgName}`);
    }

    /**
     * Initializes the wallet and CA client. Must be called before any registration.
     * @returns {Promise<void>}
     */
    async initialize() {
        this.ca = new FabricCAServices(this.orgConfig.caUrl, {
            trustedRoots: [],
            verify: false
        }, this.orgConfig.caName);
    }
    /**
     * Ensures that an admin identity exists in the wallet, enrolling it if necessary.
     * @returns {Promise<object>} The admin user context
     */
    async ensureAdmin() {
        const adminLabel = `admin-${this.orgName}`;
        let adminIdentity = await this.wallet.get(adminLabel);
        if (!adminIdentity) {
            console.log(`Admin for ${this.orgName} not found. Enrolling...`);
            try {
                const adminEnrollment = await this.ca.enroll({
                    enrollmentID: this.orgConfig.adminId,
                    enrollmentSecret: this.orgConfig.adminSecret
                });
                adminIdentity = {
                    credentials: {
                        certificate: adminEnrollment.certificate,
                        privateKey: adminEnrollment.key.toBytes(),
                    },
                    mspId: this.orgConfig.mspId,
                    type: 'X.509',
                };
                await this.wallet.put(adminLabel, adminIdentity);
                console.log(`✓ Admin for ${this.orgName} enrolled successfully`);
            } catch (err) {
                throw new Error(`Admin enrollment failed for ${this.orgName}: ${err.message}`);
            }
        }
        const provider = this.wallet.getProviderRegistry().getProvider(adminIdentity.type);
        return await provider.getUserContext(adminIdentity, adminLabel);
    }
    /**
     * Adds an affiliation to the CA. Requires admin privileges.
     * @param {string} affiliationPath - The affiliation path to add (e.g., 'citygeneral.doctors').
     * @returns {Promise<void>}
     */
    async addAffiliation(affiliationPath) {
        const adminUser = await this.ensureAdmin();
        try {
            await this.ca.newAffiliationService().create({ name: affiliationPath }, adminUser);
            console.log(`✓ Affiliation '${affiliationPath}' added successfully.`);
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log(`Affiliation '${affiliationPath}' already exists.`);
            } else {
                throw new Error(`Failed to add affiliation: ${err.message}`);
            }
        }
    }

    /**
     * Checks if a user identity already exists in the wallet.
     * @param {string} enrollmentID
     * @returns {Promise<boolean>}
     */
    async userExists(enrollmentID) {
        const identity = await this.wallet.get(enrollmentID);
        return !!identity;
    }

    /**
     * Returns the affiliation string for a given user type, based on the organization.
     * @param {string} userType
     * @returns {string}
     */
    getAffiliation(userType) {
        const org = this.orgName;
        const map = {
            'PlatformOrg': {
                'admin': 'platform.admins',
                'peer': 'platform.peers',
                'client': 'platform',
                'user': 'platform'
            },
            'PatientOrg': {
                'admin': 'patients.users',
                'peer': 'patients.peers',
                'client': 'patients',
                'patient': 'patients',
                'user': 'patients'
            },
            'ProviderOrg': {
                'admin': 'provider.hospitals',
                'doctor': 'provider.doctors',
                'hospital': 'provider.hospitals',
                'clinic': 'provider.clinics',
                'peer': 'provider.platform',
                'client': 'provider.doctors'
            },
            'citygeneral': {
                'admin': 'citygeneral',
                'client': 'citygeneral',
                'doctor': 'citygeneral.doctors',
                'peer': 'citygeneral',
                'hospital': 'citygeneral.hospitals',
            }
        };
        // If the org is not in the map, return the base affiliation from config
        return map[org]?.[userType] || this.orgConfig.affiliation;
    }

    /**
     * Registers and enrolls a new user.
     * @param {string} enrollmentID - Unique ID (e.g., email)
     * @param {string} userType - Type of user (e.g., 'client', 'admin', 'doctor')
     * @param {string} displayName - Human‑readable name (optional, defaults to enrollmentID)
     * @param {string} [password] - Optional password; if not provided, CA generates one
     * @returns {Promise<object>} The enrolled identity object
     */
    async registerAndEnrollUser(enrollmentID, userType, displayName = enrollmentID, exaffiliation=null,password = null,) {
        if (await this.userExists(enrollmentID)) {
            const identity = await this.wallet.get(enrollmentID);
            console.log(`User ${enrollmentID} already exists in wallet`);
            return identity;
        }


        const adminUser = await this.ensureAdmin();
        let affiliation = null;
        const caRole = userType.toLowerCase() === 'admin' ? 'admin' : 'client';
        if (this.orgName==='ProviderOrg' && exaffiliation){
            affiliation=`provider.hospitals.${exaffiliation}`;
        }else{
            affiliation=this.getAffiliation(userType);
        }
        console.log(this.orgName,exaffiliation,displayName);
        const regRequest = {
            affiliation: affiliation,
            enrollmentID: enrollmentID,
            role: caRole,
            attrs: [
                { name: 'role', value: userType, ecert: true },
                { name: 'displayName', value: displayName, ecert: true }
            ]
        };
        if (password) {
            regRequest.enrollmentSecret = password;
        }

        console.log(`Registering ${enrollmentID} as ${userType}...`);
        let secret;
        try {
            secret = await this.ca.register(regRequest, adminUser);
            console.log(`✓ Registered with secret: ${secret}`);
        } catch (err) {
            if (err.message.includes('already registered')) {
                console.log('User already registered, proceeding with enrollment...');
                secret = password || `${enrollmentID}pw`;
            } else {
                console.log(err);
                throw new Error(`Registration failed: ${err.message}`);
            }
        }

        console.log(`Enrolling ${enrollmentID}...`);
        try {
            const enrollment = await this.ca.enroll({
                enrollmentID: enrollmentID,
                enrollmentSecret: secret
            });

            const userIdentity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: this.orgConfig.mspId,
                type: 'X.509',
            };

            await this.wallet.put(enrollmentID, userIdentity);
            console.log(`✅ User ${enrollmentID} enrolled successfully`);
            return userIdentity;
        } catch (err) {
            throw new Error(`Enrollment failed: ${err.message}`);
        }
    }
}

module.exports = UserRegistrationClient;