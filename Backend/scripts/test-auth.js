async function testAuth() {
    console.log("1. Registering new user...");
    try {
        const regRes = await fetch("http://localhost:5000/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "test_new_user3@test.com",
                password: "password123",
                name: "Test User 3"
            })
        });
        console.log("Register response:", Object.fromEntries(regRes.headers), await regRes.text());
    } catch (e) {
        console.error("Register failed", e);
    }

    console.log("\n2. Logging in with same user...");
    try {
        const loginRes = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "test_new_user3@test.com",
                password: "password123"
            })
        });
        console.log("Login Status:", loginRes.status);
        console.log("Login Body:", await loginRes.text());
    } catch (e) {
        console.error("Login failed", e);
    }
}

testAuth();
