const express = require("express");
const session = require("express-session");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcrypt");
const fs = require("fs");
const multer = require("multer");
const sharp = require("sharp");

dotenv.config();

const db = require("./db");
// ===============================
// PROFILE PICTURE UPLOAD
// ===============================

const uploadDirectory = path.join(
    __dirname,
    "..",
    "uploads",
    "profile-pictures"
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },

    filename: function (req, file, cb) {
        const uniqueName =
            `profile-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG and WebP images are allowed."));
        }
    }
});

const app = express();
const PORT = process.env.PORT || 3000;
const allowedAvatars = new Set([
    "avatar-sun.svg",
    "avatar-leaf.svg",
    "avatar-wave.svg",
    "avatar-star.svg"
]);
app.set("trust proxy", 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(
session({
secret: process.env.SESSION_SECRET || "key-of-heaven-secret",
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
secure: process.env.NODE_ENV === "production",
maxAge: 1000 * 60 * 60 * 24
}
})
);

// Serve website files
app.use(express.static(path.join(__dirname, "..")));

// Test API
app.get("/api/status", (req, res) => {
res.json({
success: true,
message: "Key of Heaven backend is running."
});
});
// Member Signup
app.post("/api/signup", upload.single("profilePicture"), async (req, res) => {
    try {
        const {
            full_name,
            username,
            email,
            phone,
            password,
            bio,
            favorite_scripture,
            prayer_interests,
            profile_visibility,
            avatar
        } = req.body;

        // Check required fields
        if (!full_name || !username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        // Check if username or email already exists
        const checkSql = `
            SELECT id
            FROM members
            WHERE username = ? OR email = ?
        `;

        db.query(checkSql, [username, email], async (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "Database error."
                });
            }

            if (results.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Username or email already exists."
                });
            }

            // Hash password
            const passwordHash = await bcrypt.hash(password, 10);

            // Insert member
            const insertSql = `
                INSERT INTO members
                (
                    full_name,
                    username,
                    email,
                    phone,
                    password_hash,
                    bio,
                    favorite_scripture,
                    prayer_interests,
                    profile_visibility,
                    profile_picture
                )
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.query(
                insertSql,
                            [
                    full_name,
                    username,
                    email,
                    phone || null,
                    passwordHash,
                    bio || null,
                    favorite_scripture || null,
                    prayer_interests || null,
                    profile_visibility || "public",
                    req.file
                        ? `/uploads/profile-pictures/${req.file.filename}`
                        : allowedAvatars.has(avatar)
                            ? `/images/${avatar}`
                            : null
                ],
                (err, result) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({
                            success: false,
                            message: "Could not create account."
                        });
                    }

                    res.status(201).json({
                        success: true,
                        message: "Account created successfully!"
                    });
                }
            );
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Something went wrong."
        });
    }
});
// Member Login
app.post("/api/login", (req, res) => {

    const { email, password } = req.body;

    // Check required fields
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Please enter your email and password."
        });
    }

    // Find member by email
    const sql = `
        SELECT *
        FROM members
        WHERE email = ?
        LIMIT 1
    `;

    db.query(sql, [email], async (err, results) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        // Account not found
        if (results.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const member = results[0];

        // Compare password
        const passwordMatch = await bcrypt.compare(
            password,
            member.password_hash
        );

        if (!passwordMatch) {

            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // Create login session
        req.session.memberId = member.id;

        req.session.member = {
            id: member.id,
            full_name: member.full_name,
            username: member.username,
            email: member.email,
            is_admin: member.is_admin
        };

        return res.json({
            success: true,
            message: "Login successful!",
            member: req.session.member
        });

    });

});
// Get currently logged-in member
app.get("/api/me", (req, res) => {

    if (!req.session.memberId) {
        return res.status(401).json({
            success: false,
            message: "You are not logged in."
        });
    }

    const sql = `
        SELECT
            id,
            full_name,
            username,
            email,
            phone,
            bio,
            favorite_scripture,
            prayer_interests,
            profile_visibility,
            profile_picture,
            date_joined,
            is_admin
        FROM members
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [req.session.memberId], (err, results) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Member account not found."
            });
        }

        res.json({
            success: true,
            member: results[0]
        });

    });

});
// Update member profile
app.put("/api/profile", (req, res) => {

    if (!req.session.memberId) {
        return res.status(401).json({
            success: false,
            message: "You are not logged in."
        });
    }

    // Handle profile picture upload
    upload.single("profilePicture")(req, res, async (uploadError) => {

        if (uploadError) {
            console.error("Profile picture upload error:", uploadError);

            return res.status(400).json({
                success: false,
                message: uploadError.message
            });
        }

        const {
            full_name,
            username,
            email,
            phone,
            bio,
            favorite_scripture,
            profile_visibility
        } = req.body;

        if (!full_name || !username || !email) {

            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }

            return res.status(400).json({
                success: false,
                message: "Name, username and email are required."
            });
        }

        // First get the current profile picture
        const getOldPictureSql = `
            SELECT profile_picture
            FROM members
            WHERE id = ?
            LIMIT 1
        `;

        db.query(
            getOldPictureSql,
            [req.session.memberId],
            async (getErr, rows) => {

                if (getErr) {
                    console.error(getErr);

                    if (req.file) {
                        fs.unlink(req.file.path, () => {});
                    }

                    return res.status(500).json({
                        success: false,
                        message: "Could not retrieve your current profile."
                    });
                }

                const oldProfilePicture =
                    rows.length > 0
                        ? rows[0].profile_picture
                        : null;

                let newProfilePicture = oldProfilePicture;

                // ==========================================
                // RESIZE NEW PROFILE PICTURE WITH SHARP
                // ==========================================

                if (req.file) {

                    try {

                        await sharp(req.file.path)
                            .resize(500, 500, {
                                fit: "cover",
                                position: "centre"
                            })
                            .jpeg({
                                quality: 85
                            })
                            .toFile(
                                req.file.path + "-resized.jpg"
                            );

                        // Delete the original uploaded image
                        fs.unlink(req.file.path, () => {});

                        // Rename resized image to the original filename
                        const resizedPath =
                            req.file.path + "-resized.jpg";

                        const finalPath =
                            req.file.path;

                        fs.renameSync(
                            resizedPath,
                            finalPath
                        );

                        newProfilePicture =
                            `/uploads/profile-pictures/${req.file.filename}`;

                    } catch (imageError) {

                        console.error(
                            "Profile picture processing error:",
                            imageError
                        );

                        if (req.file) {
                            fs.unlink(req.file.path, () => {});
                        }

                        return res.status(500).json({
                            success: false,
                            message: "Could not process your profile picture."
                        });
                    }
                }

                const sql = `
                    UPDATE members
                    SET
                        full_name = ?,
                        username = ?,
                        email = ?,
                        phone = ?,
                        bio = ?,
                        favorite_scripture = ?,
                        profile_visibility = ?,
                        profile_picture = ?
                    WHERE id = ?
                `;

                db.query(
                    sql,
                    [
                        full_name,
                        username,
                        email,
                        phone || null,
                        bio || null,
                        favorite_scripture || null,
                        profile_visibility || "public",
                        newProfilePicture,
                        req.session.memberId
                    ],
                    (err) => {

                        if (err) {

                            console.error(err);

                            if (req.file) {
                                fs.unlink(req.file.path, () => {});
                            }

                            if (err.code === "ER_DUP_ENTRY") {
                                return res.status(409).json({
                                    success: false,
                                    message: "That username or email is already being used."
                                });
                            }

                            return res.status(500).json({
                                success: false,
                                message: "Could not update your profile."
                            });
                        }

                        // ==========================================
                        // DELETE OLD PROFILE PICTURE
                        // ==========================================

                        if (
                            req.file &&
                            oldProfilePicture &&
                            oldProfilePicture.startsWith(
                                "/uploads/profile-pictures/"
                            )
                        ) {

                            const oldFileName =
                                path.basename(oldProfilePicture);

                            const newFileName =
                                path.basename(newProfilePicture);

                            // Don't accidentally delete the new picture
                            if (oldFileName !== newFileName) {

                                const oldFilePath =
                                    path.join(
                                        uploadDirectory,
                                        oldFileName
                                    );

                                if (fs.existsSync(oldFilePath)) {

                                    fs.unlink(
                                        oldFilePath,
                                        (deleteErr) => {

                                            if (deleteErr) {
                                                console.error(
                                                    "Could not delete old profile picture:",
                                                    deleteErr.message
                                                );
                                            }

                                        }
                                    );

                                }
                            }
                        }

                        // Keep session information up to date
                        req.session.member.full_name =
                            full_name;

                        req.session.member.username =
                            username;

                        req.session.member.email =
                            email;

                        req.session.member.profile_picture =
                            newProfilePicture;

                        res.json({
                            success: true,
                            message: "Profile updated successfully.",
                            profile_picture: newProfilePicture
                        });

                    }
                );

            }
        );

    });

});
app.post("/api/prayer-requests", (req, res) => {

    // Make sure the member is logged in
    if (!req.session.memberId) {
        return res.status(401).json({
            success: false,
            message: "You must be logged in to submit a prayer request."
        });
    }

            const {
                prayer_request,
                prayer_email,
                prayer_phone,
                is_private,
                allow_contact
            } = req.body;
    // Validate the prayer request
    if (!prayer_request || !prayer_request.trim()) {
        return res.status(400).json({
            success: false,
            message: "Please enter your prayer request."
        });
    }

    const sql = `
    INSERT INTO prayer_requests
    (
        member_id,
        prayer_request,
        prayer_email,
        prayer_phone,
        is_private,
        allow_contact
    )
    VALUES (?, ?, ?, ?, ?, ?)
`;

    db.query(
        sql,
        [
            req.session.memberId,
            prayer_request.trim(),
            prayer_email ? prayer_email.trim() : null,
            prayer_phone ? prayer_phone.trim() : null,
            is_private === true ? 1 : 0,
            allow_contact === true ? 1 : 0
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "Prayer request database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not save your prayer request."
                });
            }

            res.status(201).json({
                success: true,
                message: "Your prayer request has been submitted.",
                prayerRequestId: result.insertId
            });

        }
    );

});
// Logout
app.post("/api/logout", (req, res) => {

    req.session.destroy((err) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Could not log out."
            });
        }

        res.json({
            success: true,
            message: "Logged out successfully."
        });

    });

});
// Get public members
app.get("/api/members", (req, res) => {

    const sql = `
        SELECT
            id,
            full_name,
            username,
            email,
            bio,
            favorite_scripture,
            profile_picture,
            date_joined
        FROM members
        WHERE profile_visibility = 'public'
        ORDER BY date_joined DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Could not load members."
            });
        }

        res.json({
            success: true,
            members: results
        });

    });

});
// Check if the logged-in member is an admin
function requireAdmin(req, res, next) {

    if (!req.session.memberId) {
        return res.status(401).json({
            success: false,
            message: "You must be logged in."
        });
    }

    const sql = `
        SELECT id, full_name, username, email, is_admin
        FROM members
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [req.session.memberId], (err, results) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Member account not found."
            });
        }

        const member = results[0];

        if (member.is_admin !== 1) {
            return res.status(403).json({
                success: false,
                message: "Admin access required."
            });
        }

        req.admin = member;

        next();
    });
}
// Admin: Get all prayer requests
app.get("/api/admin/prayer-requests", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            prayer_requests.id,
            prayer_requests.prayer_request,
            prayer_requests.prayer_email,
            prayer_requests.prayer_phone,
            prayer_requests.is_private,
            prayer_requests.allow_contact,
            prayer_requests.status,
            prayer_requests.created_at,
            members.full_name,
            members.username
        FROM prayer_requests
        INNER JOIN members
            ON prayer_requests.member_id = members.id
        ORDER BY prayer_requests.created_at DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Admin prayer requests database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load prayer requests."
            });
        }

        res.json({
            success: true,
            prayerRequests: results
        });

    });

});
// Admin: Update prayer request status
app.put(
    "/api/admin/prayer-requests/:id/status",
    requireAdmin,
    (req, res) => {

        const prayerRequestId = req.params.id;
        const { status } = req.body;

        const allowedStatuses = [
            "pending",
            "prayed",
            "answered"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid prayer request status."
            });
        }

        const sql = `
            UPDATE prayer_requests
            SET status = ?
            WHERE id = ?
        `;

        db.query(
            sql,
            [status, prayerRequestId],
            (err, result) => {

                if (err) {
                    console.error(
                        "Prayer request status update error:",
                        err
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            "Could not update prayer request status."
                    });
                }

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Prayer request not found."
                    });
                }

                res.json({
                    success: true,
                    message: "Prayer request status updated."
                });

            }
        );

    }
);
// Admin: Get all teachings
app.get("/api/admin/teachings", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            teachings.id,
            teachings.title,
            teachings.content,
            teachings.status,
            teachings.created_at,
            teachings.updated_at,
            members.full_name AS author_name,
            members.username AS author_username
        FROM teachings
        INNER JOIN members
            ON teachings.author_id = members.id
        ORDER BY teachings.created_at DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Admin teachings database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load teachings."
            });
        }

        res.json({
            success: true,
            teachings: results
        });

    });

});
// Admin: Create a teaching
app.post("/api/admin/teachings", requireAdmin, (req, res) => {

    const { title, content, status } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({
            success: false,
            message: "Please enter a teaching title."
        });
    }

    if (!content || !content.trim()) {
        return res.status(400).json({
            success: false,
            message: "Please enter the teaching content."
        });
    }

    const allowedStatuses = [
        "draft",
        "published"
    ];

    const teachingStatus =
        allowedStatuses.includes(status)
            ? status
            : "draft";

    const sql = `
        INSERT INTO teachings
        (
            title,
            content,
            author_id,
            status
        )
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title.trim(),
            content.trim(),
            req.session.memberId,
            teachingStatus
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "Create teaching database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not create teaching."
                });
            }

            res.status(201).json({
                success: true,
                message: "Teaching created successfully.",
                teachingId: result.insertId
            });

        }
    );

});
// Admin: Update a teaching
app.put("/api/admin/teachings/:id", requireAdmin, (req, res) => {

    const teachingId = req.params.id;
    const { title, content, status } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({
            success: false,
            message: "Please enter a teaching title."
        });
    }

    if (!content || !content.trim()) {
        return res.status(400).json({
            success: false,
            message: "Please enter the teaching content."
        });
    }

    const allowedStatuses = [
        "draft",
        "published"
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Invalid teaching status."
        });
    }

    const sql = `
        UPDATE teachings
        SET
            title = ?,
            content = ?,
            status = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            title.trim(),
            content.trim(),
            status,
            teachingId
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "Update teaching database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not update teaching."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Teaching not found."
                });
            }

            res.json({
                success: true,
                message: "Teaching updated successfully."
            });

        }
    );

});
// Public: Get published teachings
app.get("/api/teachings", (req, res) => {

    const sql = `
        SELECT
            teachings.id,
            teachings.title,
            teachings.content,
            teachings.created_at,
            members.full_name AS author_name
        FROM teachings
        INNER JOIN members
            ON teachings.author_id = members.id
        WHERE teachings.status = 'published'
        ORDER BY teachings.created_at DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Public teachings database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load teachings."
            });
        }

        res.json({
            success: true,
            teachings: results
        });

    });

});
app.get("/api/admin/check", (req, res) => {

    if (!req.session.memberId) {
        return res.status(401).json({
            success: false,
            isAdmin: false,
            message: "You must be logged in."
        });
    }

    const sql = `
        SELECT is_admin
        FROM members
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [req.session.memberId], (err, results) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                isAdmin: false,
                message: "Database error."
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                isAdmin: false,
                message: "Member account not found."
            });
        }

        if (results[0].is_admin !== 1) {
            return res.status(403).json({
                success: false,
                isAdmin: false,
                message: "Admin access required."
            });
        }

        res.json({
            success: true,
            isAdmin: true,
            message: "Admin access granted."
        });

    });

});
// Get all members for the admin dashboard
app.get("/api/admin/members", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            id,
            full_name,
            username,
            email,
            phone,
            bio,
            favorite_scripture,
            prayer_interests,
            profile_visibility,
            profile_picture,
            is_admin,
            date_joined
        FROM members
        ORDER BY date_joined DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                message: "Could not load members."
            });
        }

        res.json({
            success: true,
            members: results
        });

    });

});
app.put("/api/admin/members/:id/admin", requireAdmin, (req, res) => {

    const memberId = req.params.id;
    const { is_admin } = req.body;

    if (typeof is_admin !== "boolean") {
        return res.status(400).json({
            success: false,
            message: "Invalid admin status."
        });
    }

    // Prevent an admin from removing their own admin access
    if (Number(memberId) === Number(req.session.memberId)) {
        return res.status(400).json({
            success: false,
            message: "You cannot change your own admin status."
        });
    }

    const sql = `
        UPDATE members
        SET is_admin = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [is_admin ? 1 : 0, memberId],
        (err, result) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    success: false,
                    message: "Could not update admin status."
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Member not found."
                });
            }

            res.json({
                success: true,
                message: is_admin
                    ? "Member is now an admin."
                    : "Admin access removed."
            });

        }
    );

});
// =========================
// EVENTS API
// =========================

// Get all events for admin
app.get("/api/admin/events", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            events.id,
            events.title,
            events.description,
            events.event_date,
            events.event_time,
            events.location,
            events.status,
            events.created_at,
            events.updated_at,
            members.full_name AS creator_name
        FROM events
        INNER JOIN members
            ON events.created_by = members.id
        ORDER BY events.event_date ASC, events.event_time ASC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error("Admin events database error:", err);

            return res.status(500).json({
                success: false,
                message: "Could not load events."
            });
        }

        res.json({
            success: true,
            events: results
        });

    });
});


// Create a new event
app.post("/api/admin/events", requireAdmin, (req, res) => {

    const {
        title,
        description,
        event_date,
        event_time,
        location,
        status
    } = req.body;

    if (!title || !description || !event_date) {

        return res.status(400).json({
            success: false,
            message: "Title, description and event date are required."
        });

    }

    const allowedStatuses = [
        "upcoming",
        "completed",
        "cancelled"
    ];

    const eventStatus =
        allowedStatuses.includes(status)
            ? status
            : "upcoming";

    const sql = `
        INSERT INTO events
        (
            title,
            description,
            event_date,
            event_time,
            location,
            status,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title,
            description,
            event_date,
            event_time || null,
            location || null,
            eventStatus,
            req.session.memberId
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "Create event database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not create event."
                });

            }

            res.status(201).json({
                success: true,
                message: "Event created successfully.",
                eventId: result.insertId
            });

        }
    );
});


// Update an event
app.put("/api/admin/events/:id", requireAdmin, (req, res) => {

    const eventId = req.params.id;

    const {
        title,
        description,
        event_date,
        event_time,
        location,
        status
    } = req.body;

    if (!title || !description || !event_date) {

        return res.status(400).json({
            success: false,
            message: "Title, description and event date are required."
        });

    }

    const allowedStatuses = [
        "upcoming",
        "completed",
        "cancelled"
    ];

    if (!allowedStatuses.includes(status)) {

        return res.status(400).json({
            success: false,
            message: "Invalid event status."
        });

    }

    const sql = `
        UPDATE events
        SET
            title = ?,
            description = ?,
            event_date = ?,
            event_time = ?,
            location = ?,
            status = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            title,
            description,
            event_date,
            event_time || null,
            location || null,
            status,
            eventId
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "Update event database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not update event."
                });

            }

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Event not found."
                });

            }

            res.json({
                success: true,
                message: "Event updated successfully."
            });

        }
    );
});


// Delete an event
app.delete("/api/admin/events/:id", requireAdmin, (req, res) => {

    const eventId = req.params.id;

    const sql = `
        DELETE FROM events
        WHERE id = ?
    `;

    db.query(sql, [eventId], (err, result) => {

        if (err) {

            console.error(
                "Delete event database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not delete event."
            });

        }

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Event not found."
            });

        }

        res.json({
            success: true,
            message: "Event deleted successfully."
        });

    });
});


// Public events API
app.get("/api/events", (req, res) => {

    const sql = `
        SELECT
            events.id,
            events.title,
            events.description,
            events.event_date,
            events.event_time,
            events.location,
            events.status,
            events.created_at,
            members.full_name AS creator_name
        FROM events
        INNER JOIN members
            ON events.created_by = members.id
        WHERE events.status = 'upcoming'
        ORDER BY events.event_date ASC, events.event_time ASC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.error(
                "Public events database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load events."
            });

        }

        res.json({
            success: true,
            events: results
        });

    });
});// =========================
// EVENTS API
// =========================

// Get all events for admin
app.get("/api/admin/events", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            events.id,
            events.title,
            events.description,
            events.event_date,
            events.event_time,
            events.location,
            events.status,
            events.created_at,
            events.updated_at,
            members.full_name AS creator_name
        FROM events
        INNER JOIN members
            ON events.created_by = members.id
        ORDER BY events.event_date ASC, events.event_time ASC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error("Admin events database error:", err);

            return res.status(500).json({
                success: false,
                message: "Could not load events."
            });
        }

        res.json({
            success: true,
            events: results
        });

    });
});


// Create a new event
app.post("/api/admin/events", requireAdmin, (req, res) => {

    const {
        title,
        description,
        event_date,
        event_time,
        location,
        status
    } = req.body;

    if (!title || !description || !event_date) {

        return res.status(400).json({
            success: false,
            message: "Title, description and event date are required."
        });

    }

    const allowedStatuses = [
        "upcoming",
        "completed",
        "cancelled"
    ];

    const eventStatus =
        allowedStatuses.includes(status)
            ? status
            : "upcoming";

    const sql = `
        INSERT INTO events
        (
            title,
            description,
            event_date,
            event_time,
            location,
            status,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title,
            description,
            event_date,
            event_time || null,
            location || null,
            eventStatus,
            req.session.memberId
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "Create event database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not create event."
                });

            }

            res.status(201).json({
                success: true,
                message: "Event created successfully.",
                eventId: result.insertId
            });

        }
    );
});


// Update an event
app.put("/api/admin/events/:id", requireAdmin, (req, res) => {

    const eventId = req.params.id;

    const {
        title,
        description,
        event_date,
        event_time,
        location,
        status
    } = req.body;

    if (!title || !description || !event_date) {

        return res.status(400).json({
            success: false,
            message: "Title, description and event date are required."
        });

    }

    const allowedStatuses = [
        "upcoming",
        "completed",
        "cancelled"
    ];

    if (!allowedStatuses.includes(status)) {

        return res.status(400).json({
            success: false,
            message: "Invalid event status."
        });

    }

    const sql = `
        UPDATE events
        SET
            title = ?,
            description = ?,
            event_date = ?,
            event_time = ?,
            location = ?,
            status = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [
            title,
            description,
            event_date,
            event_time || null,
            location || null,
            status,
            eventId
        ],
        (err, result) => {

            if (err) {

                console.error(
                    "Update event database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not update event."
                });

            }

            if (result.affectedRows === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Event not found."
                });

            }

            res.json({
                success: true,
                message: "Event updated successfully."
            });

        }
    );
});


// Delete an event
app.delete("/api/admin/events/:id", requireAdmin, (req, res) => {

    const eventId = req.params.id;

    const sql = `
        DELETE FROM events
        WHERE id = ?
    `;

    db.query(sql, [eventId], (err, result) => {

        if (err) {

            console.error(
                "Delete event database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not delete event."
            });

        }

        if (result.affectedRows === 0) {

            return res.status(404).json({
                success: false,
                message: "Event not found."
            });

        }

        res.json({
            success: true,
            message: "Event deleted successfully."
        });

    });
});


// Public events API
app.get("/api/events", (req, res) => {

    const sql = `
        SELECT
            events.id,
            events.title,
            events.description,
            events.event_date,
            events.event_time,
            events.location,
            events.status,
            events.created_at,
            members.full_name AS creator_name
        FROM events
        INNER JOIN members
            ON events.created_by = members.id
        WHERE events.status = 'upcoming'
        ORDER BY events.event_date ASC, events.event_time ASC
    `;

    db.query(sql, (err, results) => {

        if (err) {

            console.error(
                "Public events database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load events."
            });

        }

        res.json({
            success: true,
            events: results
        });

    });
});
// =========================
// PAST PRAYERS API
// =========================

// Admin: Get all past prayers
app.get("/api/admin/past-prayers", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            id,
            title,
            prayer_day,
            prayer_date,
            prayer_leader,
            prayer_points,
            recording_link,
            description,
            created_at,
            updated_at
        FROM past_prayers
        ORDER BY prayer_date DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Admin past prayers database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load past prayers."
            });
        }

        res.json({
            success: true,
            pastPrayers: results
        });

    });

});// =========================
// PAST PRAYERS API
// =========================

// Admin: Get all past prayers
app.get("/api/admin/past-prayers", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            id,
            title,
            prayer_day,
            prayer_date,
            prayer_leader,
            prayer_points,
            recording_link,
            description,
            created_at,
            updated_at
        FROM past_prayers
        ORDER BY prayer_date DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Admin past prayers database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load past prayers."
            });
        }

        res.json({
            success: true,
            pastPrayers: results
        });

    });

});// =========================
// PAST PRAYERS API
// =========================

// Admin: Get all past prayers
app.get("/api/admin/past-prayers", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            id,
            title,
            prayer_day,
            prayer_date,
            prayer_leader,
            prayer_points,
            recording_link,
            description,
            created_at,
            updated_at
        FROM past_prayers
        ORDER BY prayer_date DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Admin past prayers database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load past prayers."
            });
        }

        res.json({
            success: true,
            pastPrayers: results
        });

    });

});// =========================
// PAST PRAYERS API
// =========================

// Admin: Get all past prayers
app.get("/api/admin/past-prayers", requireAdmin, (req, res) => {

    const sql = `
        SELECT
            id,
            title,
            prayer_day,
            prayer_date,
            prayer_leader,
            prayer_points,
            recording_link,
            description,
            created_at,
            updated_at
        FROM past_prayers
        ORDER BY prayer_date DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Admin past prayers database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load past prayers."
            });
        }

        res.json({
            success: true,
            pastPrayers: results
        });

    });

});
// Admin: Create a past prayer
app.post("/api/admin/past-prayers", requireAdmin, (req, res) => {

    const {
        title,
        prayer_day,
        prayer_date,
        prayer_leader,
        prayer_points,
        recording_link,
        description
    } = req.body;

    // Required fields
    if (!title || !prayer_day || !prayer_date) {
        return res.status(400).json({
            success: false,
            message: "Title, prayer day and prayer date are required."
        });
    }

    // Only Monday or Friday is allowed
    const allowedDays = [
        "Monday",
        "Friday"
    ];

    if (!allowedDays.includes(prayer_day)) {
        return res.status(400).json({
            success: false,
            message: "Prayer day must be Monday or Friday."
        });
    }

    const sql = `
        INSERT INTO past_prayers
        (
            title,
            prayer_day,
            prayer_date,
            prayer_leader,
            prayer_points,
            recording_link,
            description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            title.trim(),
            prayer_day,
            prayer_date,
            prayer_leader ? prayer_leader.trim() : null,
            prayer_points ? prayer_points.trim() : null,
            recording_link ? recording_link.trim() : null,
            description ? description.trim() : null
        ],
        (err, result) => {

            if (err) {
                console.error(
                    "Create past prayer database error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not create past prayer."
                });
            }

            res.status(201).json({
                success: true,
                message: "Past prayer added successfully.",
                pastPrayerId: result.insertId
            });

        }
    );

});
// Public: Get past prayers
app.get("/api/past-prayers", (req, res) => {

    const sql = `
        SELECT
            id,
            title,
            prayer_day,
            prayer_date,
            prayer_leader,
            prayer_points,
            recording_link,
            description,
            created_at
        FROM past_prayers
        ORDER BY prayer_date DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error(
                "Public past prayers database error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Could not load past prayers."
            });
        }

        res.json({
            success: true,
            pastPrayers: results
        });

    });

});
// Start server
app.listen(PORT, () => {
console.log(`Key of Heaven server running on http://localhost:${PORT}`);
});
