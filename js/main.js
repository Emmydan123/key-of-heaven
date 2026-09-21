/* =====================================================
   KEY OF HEAVEN
   MAIN JAVASCRIPT
===================================================== */


/* ================= MOBILE MENU ================= */

const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");

if (menuToggle && navbar) {

    menuToggle.addEventListener("click", () => {
        navbar.classList.toggle("show");
    });

}


/* ================= WORDS OF WISDOM ================= */

const wisdomMessages = [

    "Keep seeking Yahweh, even when the answer seems far away.",
    "A sincere prayer may begin quietly, but its impact can reach farther than you can see.",
    "Do not lose hope because of what you see today. Keep trusting Yahweh.",
    "Prayer is not only about asking; it is also about listening, trusting and drawing closer to Yahweh.",
    "When the path is unclear, continue walking in faith.",
    "Let your heart remain humble, your spirit remain willing, and your hope remain alive.",
    "There are moments when silence is not the absence of Yahweh, but an invitation to listen more closely.",
    "Keep praying. Keep believing. Keep seeking.",
    "A difficult season does not mean that your journey has ended.",
    "Faith gives us courage to continue when we cannot yet see the outcome.",
    "Bring your worries into prayer and leave room for peace to grow.",
    "The strength to continue can begin with a simple prayer.",
    "Never underestimate the value of praying for another person.",
    "Let your words be filled with kindness and your prayers with sincerity.",
    "Seek Yahweh with a genuine heart, not only when you need an answer.",
    "Every new day is another opportunity to pray, learn and grow.",
    "When you feel uncertain, return to prayer.",
    "Do not allow yesterday's difficulties to steal today's hope.",
    "A heart that continues to seek Yahweh is never without direction.",
    "Prayer can change the way we face a situation even before the situation changes.",
    "Be patient with your journey. Growth takes time.",
    "Let faith be stronger than fear.",
    "Keep your heart open to wisdom, correction and encouragement.",
    "What feels like a small step today may become a great testimony tomorrow.",
    "There is strength in standing together in prayer.",
    "Do not stop seeking simply because the answer has not arrived yet.",
    "A peaceful heart can hear what a hurried heart may miss.",
    "Let your faith guide your decisions and your character guide your actions.",
    "When you have nothing else to say, a sincere heart is still a prayer.",
    "Keep going. Your present chapter is not the whole story.",
    "Prayer is a place where the heart can become still.",
    "Encourage someone today. Your simple words may be exactly what they needed.",
    "Walk with humility, speak with kindness and pray with faith.",
    "A community becomes stronger when people care for one another.",
    "Do not be ashamed to ask for prayer when you need support.",
    "There is value in praying together, learning together and growing together.",
    "Let every challenge teach you patience and every blessing teach you gratitude.",
    "When life becomes noisy, make room for quiet prayer.",
    "Trust the process of growth and continue seeking wisdom.",
    "Your prayer does not need complicated words. Let it come from a sincere heart."

];

const wisdomText = document.getElementById("wisdomText");
const wisdomNumber = document.getElementById("wisdomNumber");
const previousWisdom = document.getElementById("previousWisdom");
const nextWisdom = document.getElementById("nextWisdom");

let wisdomIndex = 0;


function displayWisdom() {

    if (!wisdomText) {
        return;
    }

    wisdomText.textContent =
        wisdomMessages[wisdomIndex];

    if (wisdomNumber) {

        wisdomNumber.textContent =
            String(wisdomIndex + 1).padStart(2, "0");

    }

}


function nextMessage() {

    wisdomIndex++;

    if (wisdomIndex >= wisdomMessages.length) {
        wisdomIndex = 0;
    }

    displayWisdom();

}


function previousMessage() {

    wisdomIndex--;

    if (wisdomIndex < 0) {
        wisdomIndex = wisdomMessages.length - 1;
    }

    displayWisdom();

}


if (nextWisdom) {
    nextWisdom.addEventListener("click", nextMessage);
}


if (previousWisdom) {
    previousWisdom.addEventListener("click", previousMessage);
}


displayWisdom();


setInterval(() => {
    nextMessage();
}, 7000);


/* ================= CURRENT YEAR ================= */

const currentYear =
    document.getElementById("currentYear");

if (currentYear) {

    currentYear.textContent =
        new Date().getFullYear();

}


/* ================= CLOSE MOBILE MENU ================= */

document.querySelectorAll(".navbar a")
    .forEach(link => {

        link.addEventListener("click", () => {

            if (navbar) {
                navbar.classList.remove("show");
            }

        });

    });


/* =========================================================
   PROGRESSIVE WEB APP
========================================================= */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker
            .register("/service-worker.js")
            .then(() => {

                console.log(
                    "Key of Heaven app is ready."
                );

            })
            .catch(error => {

                console.error(
                    "Service Worker registration failed:",
                    error
                );

            });

    });

}


/* =========================================================
   PERSISTENT MEMBER NAVIGATION
========================================================= */

async function loadMemberNavigation() {

    try {

        /*
         * Use the same API address from every page.
         * This works from both:
         *
         * /index.html
         * /pages/about.html
         * /pages/events.html
         */

        const response = await fetch("/api/me", {
            method: "GET",
            credentials: "include",
            headers: {
                "Accept": "application/json"
            }
        });


        /* ---------------------------------------------
           Safely read the response
        --------------------------------------------- */

        let data = {};

        try {
            data = await response.json();
        } catch (error) {

            console.error(
                "Could not read /api/me response:",
                error
            );

            return;
        }


        /* ---------------------------------------------
           Find the navigation
        --------------------------------------------- */

        const navigation =
            document.getElementById("navbar");

        if (!navigation) {

            console.warn(
                "Navbar element #navbar was not found."
            );

            return;
        }


        /*
         * Find the actual list containing navigation
         *
         * This supports:
         *
         * .nav-links
         * .navbar ul
         */

        const navLinks =
            navigation.querySelector(".nav-links") ||
            navigation.querySelector("ul") ||
            navigation;


        if (!navLinks) {

            console.warn(
                "Navigation links container was not found."
            );

            return;
        }


        /* ---------------------------------------------
           NOT LOGGED IN
        --------------------------------------------- */

        if (
            !response.ok ||
            !data.success ||
            !data.member
        ) {

            console.log(
                "No logged-in member."
            );

            return;
        }


        const member = data.member;


        console.log(
            "Logged-in member:",
            member.full_name || member.username
        );


        /* ---------------------------------------------
           Find Login link
        --------------------------------------------- */

        let loginLink =
            navLinks.querySelector(".nav-login");


        /*
         * Fallback:
         * Find an ordinary link pointing to login.html
         */

        if (!loginLink) {

            loginLink =
                Array.from(
                    navLinks.querySelectorAll("a")
                ).find(link => {

                    const href =
                        link.getAttribute("href") || "";

                    return href.includes("login.html");

                });

        }


        /*
         * The login link may itself be an <a>,
         * or it may be inside an <li>.
         */

        let loginContainer = null;


        if (loginLink) {

            loginContainer =
                loginLink.closest("li") ||
                loginLink;

        }


        /* ---------------------------------------------
           Prevent duplicate account links
        --------------------------------------------- */

        const oldAccount =
            navLinks.querySelector(".nav-account");

        if (oldAccount) {
            oldAccount.remove();
        }


        /* ---------------------------------------------
           Determine account destination
        --------------------------------------------- */

        const accountPage =
            member.is_admin
                ? "/admin.html"
                : "/dashboard.html";


        /* ---------------------------------------------
           Profile picture
        --------------------------------------------- */

        let profilePicture =
            member.profile_picture;


        /*
         * Default avatar
         * Used when no profile picture exists.
         */

        const defaultAvatar =
            "data:image/svg+xml," +
            encodeURIComponent(`
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="80"
                    height="80"
                    viewBox="0 0 80 80"
                >

                    <circle
                        cx="40"
                        cy="40"
                        r="40"
                        fill="#dddddd"
                    />

                    <circle
                        cx="40"
                        cy="30"
                        r="14"
                        fill="#888888"
                    />

                    <path
                        d="
                            M16 70
                            C16 54 27 46 40 46
                            C53 46 64 54 64 70
                            Z
                        "
                        fill="#888888"
                    />

                </svg>
            `);


        if (!profilePicture) {
            profilePicture = defaultAvatar;
        }


        /* ---------------------------------------------
           Create account link
        --------------------------------------------- */

        const accountLink =
            document.createElement("a");

        accountLink.href =
            accountPage;

        accountLink.className =
            "nav-account";

        accountLink.title =
            member.is_admin
                ? "Open Admin Dashboard"
                : "Open My Dashboard";


        /* ---------------------------------------------
           Create avatar
        --------------------------------------------- */

        const avatar =
            document.createElement("span");

        avatar.className =
            "nav-account-avatar";


        const image =
            document.createElement("img");

        image.src =
            profilePicture;

        image.alt =
            "Profile picture";


        image.onerror = function () {

            this.onerror = null;

            this.src =
                defaultAvatar;

        };


        avatar.appendChild(image);


        /* ---------------------------------------------
           Member name
        --------------------------------------------- */

        const name =
            document.createElement("span");

        name.className =
            "nav-account-name";

        name.textContent =
            member.full_name ||
            member.username ||
            "Account";


        /* ---------------------------------------------
           Put account together
        --------------------------------------------- */

        accountLink.appendChild(avatar);

        accountLink.appendChild(name);


        /* ---------------------------------------------
           Replace Login
        --------------------------------------------- */

        if (loginContainer) {

            loginContainer.innerHTML = "";

            loginContainer.appendChild(
                accountLink
            );

        } else {

            /*
             * If no Login link exists,
             * add the account to the navigation.
             */

            const accountListItem =
                document.createElement("li");

            accountListItem.className =
                "nav-account-item";

            accountListItem.appendChild(
                accountLink
            );

            navLinks.appendChild(
                accountListItem
            );

        }


        console.log(
            "Member navigation loaded successfully."
        );

    } catch (error) {

        console.error(
            "Could not load member navigation:",
            error
        );

    }

}


/* =========================================================
   START MEMBER NAVIGATION
========================================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        loadMemberNavigation
    );

} else {

    loadMemberNavigation();

}