import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { SEED_MODELS } from "../data/seeddata";

const client = generateClient() as any;

const SystemBootstrap = () => {
  const isBootstrapping = useRef(false);

  useEffect(() => {
    const bootstrapFoundationModels = async () => {
      try {
        const { data: existingModels } = await client.models.FoundationModel.list({ limit: 1 });
        
        if (existingModels.length === 0 && !isBootstrapping.current) {
          isBootstrapping.current = true;
          console.log("Database is empty. Initiating Foundation Models bootstrap...");
          
          const createPromises = SEED_MODELS.map(model => 
            client.models.FoundationModel.create(model).catch((err: any) => 
              console.error(`Failed to bootstrap model: ${model.name}`, err)
            )
          );

          await Promise.all(createPromises);
          console.log("Foundation Models successfully bootstrapped!");
        }
      } catch (error) {
        console.error("Error checking/bootstrapping foundation models:", error);
      }
    };

    bootstrapFoundationModels();
  }, []);

  return null;
};

export default SystemBootstrap;