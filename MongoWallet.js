const { Wallet } = require('fabric-network');
const { Identity } = require('./Database');

class MongoWallet extends Wallet {
  constructor() {
    super();
    // The base Wallet class requires a provider registry; we'll use the default one.
    // We can either import a default provider registry or create one.
    // For simplicity, we'll rely on the parent's default provider registry.
  }

  async put(label, identity) {
    await Identity.findOneAndUpdate(
      { label },
      {
        label,
        certificate: identity.credentials.certificate,
        privateKey: identity.credentials.privateKey,
        mspId: identity.mspId,
        userType: identity.type,
      },
      { upsert: true }
    );
    return true;
  }

  async get(label) {
    const doc = await Identity.findOne({ label }).lean();
    if (!doc) return null;
    return {
      credentials: {
        certificate: doc.certificate,
        privateKey: doc.privateKey,
      },
      mspId: doc.mspId,
      type: doc.userType,
    };
  }

  async list() {
    const docs = await Identity.find({}, 'label').lean();
    return docs.map(doc => doc.label);
  }

  async remove(label) {
    const result = await Identity.deleteOne({ label });
    return result.deletedCount === 1;
  }
}

module.exports = MongoWallet;