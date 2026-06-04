import { defineStorage } from "@aws-amplify/backend";

export const vectorCollectionsS3 = defineStorage({
  name: "vectorCollections",
  isDefault: true,
  keepOnDelete: false,
  access: (allow) => ({
    'vector-collections/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['superadmin', 'root']).to(['read', 'write', 'delete']),
      allow.groups(['admin', 'heda']).to(['read', 'delete'])
    ],
    'vector-documents/*': [
      allow.groups(['superadmin', 'root']).to(['read', 'write', 'delete']),
      allow.groups(['admin', 'heda']).to(['read', 'delete'])
    ],
  })
});

export const vectorStoreS3 = defineStorage({
  name: "vectorStore",
  isDefault: false,
  keepOnDelete: false,
  access: (allow) => ({
    'vector-store/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['superadmin', 'root']).to(['read', 'write', 'delete']),
      allow.groups(['admin', 'heda']).to(['read', 'delete'])
    ],
    'vector-stores/*': [
      allow.groups(['superadmin', 'root']).to(['read', 'write', 'delete']),
      allow.groups(['admin', 'heda']).to(['read', 'delete'])
    ],
  })
});

export const ragArtifactsS3 = defineStorage({
  name: "ragArtifacts",
  isDefault: false,
  keepOnDelete: false,
  access: (allow) => ({
    'rag-artifact/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.groups(['superadmin', 'root']).to(['read', 'write', 'delete']),
      allow.groups(['admin', 'heda']).to(['read', 'delete'])
    ],
    'rag-artifacts/*': [
      allow.groups(['superadmin', 'root']).to(['read', 'write', 'delete']),
      allow.groups(['admin', 'heda']).to(['read', 'delete'])
    ],
  })
});