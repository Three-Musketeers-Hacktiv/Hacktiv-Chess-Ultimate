const profileService = require("../services/profile.service");

const getMyProfile = async (request, response, next) => {
  try {
    const profile = await profileService.getProfile(request.user.id);
    if (!profile) {
      return response.status(401).json({ status: "error", message: "Akun tidak ditemukan." });
    }
    return response.status(200).json({ status: "success", profile });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getMyProfile };
