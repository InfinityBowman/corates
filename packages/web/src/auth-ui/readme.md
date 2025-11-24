Auth Flows:
See full-stack-fastapi-template

- src/client
- useauth src/hooks
- email pattern and password rules from src/utils.ts
- Real email pattern and password rules must be set up server side

* Look at google autofill attributes
* https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
* https://www.chromium.org/developers/design-documents/create-amazing-password-forms/
* current-password
* new-password
* email
* username
* name

1. **Sign Up Flow**
   - User opens the Sign Up form.
   - User enters email, password, and confirms password.
   - Password strength verifier?
   - On submit, app validates input and creates account.
   - If successful, app prompts user to verify email.
   - If error, app displays error message.

2. **Verify Email Flow**
   - After sign up, user is shown the Verify Email form.
   - User enters the verification code received via email.
   - On submit, app verifies the code.
   - If successful, app confirms verification and allows sign in.
   - If error, app displays error message and allows retry.

3. **Sign In Flow**
   - User opens the Sign In form.
   - User enters email and password.
   - On submit, app authenticates credentials.
   - If successful, user is logged in and redirected to the app.
   - If error, app displays error message.

4. **Reset Password Flow**
   - User opens the Reset Password form.
   - User enters email and new password (and confirms password).
   - On submit, app validates and resets password.
   - If successful, app confirms password reset and allows sign in.
   - If error, app displays error message.

5. **Sign Out Flow**
   - User clicks sign out.
   - App clears authentication state and redirects to sign in.

6. **Error Handling Flow**
   - For any failed action (sign up, sign in, verify, reset), app displays a clear error message and allows retry.

7. **Success Feedback Flow**
   - For any successful action, app displays a confirmation message and guides user to the next step.
