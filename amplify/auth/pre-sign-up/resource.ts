import { defineFunction } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
  name: 'preSignUpDomainValidator',
  entry: './handler.ts', 
  runtime: 24,  
  bundling: {
    minify: false,
  }       
});