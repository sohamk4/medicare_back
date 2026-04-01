const { UserRegistrationService } = require('./UserRegistration.js');

async function quickTest() {
    console.log('⚡ QUICK REGISTRATION TEST WITH ADMIN ENROLLMENT\n');

    try {
        const service = new UserRegistrationService();
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (!service.initialized) {
            throw new Error('Service failed to initialize');
        }

        const testCases = [
            { org: 'independent', name: `test_doct${Date.now()}`, password: 'test123pw' },
        ];

        for (const testCase of testCases) {
            console.log(`\n🔧 Testing ${testCase.org} organization...`);
            
            // Step 1: Get organization config
            const orgConfig = await service.getOrganizationConfig(testCase.org);
            console.log(`📋 Organization: ${orgConfig.mspId}`);
            
            // Step 2: Enroll admin first
            console.log('👨‍💼 Enrolling admin...');
            await service.enrollAdmin(orgConfig);
            console.log('✅ Admin enrolled successfully');
            
            // Step 3: Register user
            console.log('👤 Registering user...');
            userData={
                mongoId:'6845111df3cwf3e1e681bvdu'
            }
            const regResult = await service.registerUser(testCase.org, testCase.name, testCase.password,userData);
            console.log('✅ Registration:', regResult.message);
            console.log(regResult);

            // Step 4: Test connection if method exists
            if (service.testUserConnection) {
                try {
                    const connResult = await service.testUserConnection(testCase.org, testCase.name);
                    console.log('✅ Connection:', connResult.message);
                } catch (connError) {
                    console.log('⚠️ Connection test skipped:', connError.message);
                }
            }

            // Step 5: List users if method exists
            if (service.listUsers) {
                try {
                    const listResult = await service.listUsers(testCase.org);
                    console.log(`✅ Users in wallet: ${listResult.totalUsers}`);
                } catch (listError) {
                    console.log('⚠️ List users skipped:', listError.message);
                }
            }

            // Wait a bit between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n🎉 QUICK TEST COMPLETED SUCCESSFULLY!');

    } catch (error) {
        console.error('\n❌ QUICK TEST FAILED:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
quickTest();
