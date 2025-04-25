
function isValidPhoneNumber(phone) {
    const phoneRegex = /^(?!0{10})\d{10}$/;
    return phoneRegex.test(phone);
  }
  

  function isValidUsername(username) {
    const usernameRegex = /^[A-Za-z]{4,}$/;
    return usernameRegex.test(username);
  }
  

  