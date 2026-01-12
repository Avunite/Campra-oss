import { ILocalUser } from "@/models/entities/user";

/**
 * @deprecated This function is deprecated and will be removed in future versions. 
 * Please use [new API method name] instead.
 */
export async function getInstanceActor(): Promise<ILocalUser> {
	// Return a minimal valid ILocalUser object
	return {
	  id: 'deprecated-instance-actor',
	  username: 'instance.actor',
	  host: null,
	  // Add other required ILocalUser fields with safe default values
	} as ILocalUser;
  }