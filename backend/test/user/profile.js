const { deleteUser } = require("../framework/user");
const {
  getRoleByName,
  createUser,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
} = require("../framework/user");
const { issueJwt } = require("../framework/auth");

describe("user profile", () => {
  let userRole;
  let jwt;
  let user;
  const { localUser } = require("../mocks/user");

  beforeAll(async () => {
    await deleteUser({ email: localUser.email });
    userRole = await getRoleByName("Administrator");
    localUser.role = userRole.id;
    user = await createUser(localUser);
    jwt = await issueJwt(user.id);
  });

  afterAll(async () => {
    await deleteUser({ email: localUser.email });
  });

  it("should return user profile", async (done) => {
    const userProfile = await getUserProfile(jwt);
    expect(userProfile.statusCode).toBe(200);
    expect(userProfile.body.email).toBe(localUser.email);
    expect(userProfile.body.username).toBe(localUser.username);
    expect(userProfile.body.role.id).toBe(localUser.role);
    expect(userProfile.body.password).toBeUndefined();
    done();
  });

  it("should update user profile", async (done) => {
    const updatedProfileData = {
      firstName: "John",
      lastName: "Doe",
      username: "Johnd",
    };

    const updatedProfile = await updateUserProfile(jwt, updatedProfileData);
    expect(updatedProfile.statusCode).toBe(200);
    expect(updatedProfile.body.firstName).toBe(updatedProfileData.firstName);
    expect(updatedProfile.body.lastName).toBe(updatedProfileData.lastName);
    expect(updatedProfile.body.username).toBe(updatedProfileData.username);
    expect(updatedProfile.body.password).toBeUndefined();

    done();
  });

  it("should not update email, mobile phone and role", async (done) => {
    const updatedProfileData = {
      firstName: "John",
      lastName: "Doe",
      username: "Johnd",
      email: "someotheremail@test.com",
      role: "role_id",
      mobilePhone: "+15555555555",
    };

    const updatedProfile = await updateUserProfile(jwt, updatedProfileData);
    expect(updatedProfile.statusCode).toBe(200);
    expect(updatedProfile.body.email).not.toBe(updatedProfileData.email);
    expect(updatedProfile.body.email).toBe(localUser.email);
    expect(updatedProfile.body.role.id).not.toBe(updatedProfileData.role);
    expect(updatedProfile.body.mobilePhone).not.toBe(
      updatedProfileData.mobilePhone
    );

    done();
  });

  it("should change user password", async (done) => {
    const passwordUpdateResponse = await changeUserPassword(jwt, "demodemo");
    expect(passwordUpdateResponse.statusCode).toBe(200);
    expect(passwordUpdateResponse.notifications.flash.type).toBe("success");

    done();
  });

  it("should return `401 Unauthorized` when requesting user profile without jwt", async (done) => {
    const userProfile = await getUserProfile(undefined);
    expect(userProfile.statusCode).toBe(401);

    done();
  });
});
