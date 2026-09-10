import { PublicUser } from "Modules/User/entity/user.view";

import { EventMember } from "./event-member.model";

export interface EventMemberWithUser extends EventMember {
  user: PublicUser;
}
