CREATE TABLE IF NOT EXISTS members (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    username VARCHAR(30) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(40) NULL,
    password_hash VARCHAR(255) NOT NULL,
    bio VARCHAR(300) NULL,
    favorite_scripture VARCHAR(200) NULL,
    prayer_interests VARCHAR(500) NULL,
    profile_visibility ENUM('public', 'private') NOT NULL DEFAULT 'public',
    profile_picture VARCHAR(500) NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    date_joined TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_members_username (username),
    UNIQUE KEY uq_members_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prayer_requests (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    member_id INT UNSIGNED NOT NULL,
    prayer_request TEXT NOT NULL,
    prayer_email VARCHAR(255) NULL,
    prayer_phone VARCHAR(40) NULL,
    is_private TINYINT(1) NOT NULL DEFAULT 0,
    allow_contact TINYINT(1) NOT NULL DEFAULT 0,
    status ENUM('pending', 'prayed', 'answered') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_prayer_requests_member (member_id),
    KEY idx_prayer_requests_status (status),
    CONSTRAINT fk_prayer_requests_member
        FOREIGN KEY (member_id) REFERENCES members (id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS teachings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    author_id INT UNSIGNED NOT NULL,
    status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_teachings_status (status),
    CONSTRAINT fk_teachings_author
        FOREIGN KEY (author_id) REFERENCES members (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NULL,
    location VARCHAR(255) NULL,
    status ENUM('upcoming', 'completed', 'cancelled') NOT NULL DEFAULT 'upcoming',
    created_by INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_events_date (event_date, event_time),
    KEY idx_events_status (status),
    CONSTRAINT fk_events_creator
        FOREIGN KEY (created_by) REFERENCES members (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS past_prayers (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    prayer_day ENUM('Monday', 'Friday') NOT NULL,
    prayer_date DATE NOT NULL,
    prayer_leader VARCHAR(120) NULL,
    prayer_points TEXT NULL,
    recording_link VARCHAR(1000) NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_past_prayers_date (prayer_date)
) ENGINE=InnoDB;

-- After creating your first account, promote it with:
-- UPDATE members SET is_admin = 1 WHERE email = 'your-admin-email@example.com';
