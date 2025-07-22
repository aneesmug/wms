-- database/schema.sql

-- Drop tables in dependency order for clean re-creation
DROP TABLE IF EXISTS outbound_items;
DROP TABLE IF EXISTS outbound_orders;
DROP TABLE IF EXISTS inbound_items;
DROP TABLE IF EXISTS inbound_receipts;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS warehouse_locations;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS user_warehouse_roles; -- New table
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS warehouses;

-- 1. Warehouses Table
CREATE TABLE warehouses (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL UNIQUE,
    address VARCHAR(255),
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    -- removed global role, roles are now per warehouse or global admin
    is_global_admin BOOLEAN DEFAULT FALSE, -- New: Can manage users/warehouses globally
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. User Warehouse Roles (NEW - Junction table for N:M relationship with roles)
CREATE TABLE user_warehouse_roles (
    user_warehouse_role_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    role VARCHAR(50) DEFAULT 'operator', -- e.g., 'viewer', 'operator', 'manager' for this specific warehouse
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    UNIQUE (user_id, warehouse_id) -- A user can only have one role per warehouse
);


-- 4. Customers Table (Global)
CREATE TABLE customers (
    customer_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address_line1 VARCHAR(100),
    address_line2 VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    country VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Suppliers Table (Global)
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_name VARCHAR(100) NOT NULL UNIQUE,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address_line1 VARCHAR(100),
    address_line2 VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    country VARCHAR(50),
    payment_terms VARCHAR(50),
    tax_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Products Table (Global)
CREATE TABLE products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    unit_of_measure VARCHAR(20),
    weight DECIMAL(10, 2),
    volume DECIMAL(10, 2),
    barcode VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. Warehouse Locations Table (warehouse_id FK)
CREATE TABLE warehouse_locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    location_code VARCHAR(50) NOT NULL,
    location_type VARCHAR(50),
    max_capacity_units INT,
    max_capacity_weight DECIMAL(10, 2),
    max_capacity_volume DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
    UNIQUE (warehouse_id, location_code)
);

-- 8. Inventory Table (warehouse_id FK)
CREATE TABLE inventory (
    inventory_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    product_id INT NOT NULL,
    location_id INT NOT NULL,
    quantity INT NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE,
    unit_cost DECIMAL(10, 2),
    last_moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (location_id) REFERENCES warehouse_locations(location_id),
    UNIQUE (warehouse_id, product_id, location_id, batch_number)
);

-- 9. Inbound Receipts Table (warehouse_id FK)
CREATE TABLE inbound_receipts (
    receipt_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    receipt_number VARCHAR(50) NOT NULL,
    supplier_id INT,
    supplier_name VARCHAR(100),
    expected_arrival_date DATE,
    actual_arrival_date DATE,
    status VARCHAR(50) DEFAULT 'Pending',
    received_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
    FOREIGN KEY (received_by) REFERENCES users(user_id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    UNIQUE (warehouse_id, receipt_number)
);

-- 10. Inbound Items (linked via receipt_id and location_id)
CREATE TABLE inbound_items (
    inbound_item_id INT AUTO_INCREMENT PRIMARY KEY,
    receipt_id INT NOT NULL,
    product_id INT NOT NULL,
    expected_quantity INT NOT NULL,
    received_quantity INT DEFAULT 0,
    putaway_quantity INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Expected',
    received_location_id INT,
    final_location_id INT,
    batch_number VARCHAR(100),
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (receipt_id) REFERENCES inbound_receipts(receipt_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (received_location_id) REFERENCES warehouse_locations(location_id),
    FOREIGN KEY (final_location_id) REFERENCES warehouse_locations(location_id)
);

-- 11. Outbound Orders Table (warehouse_id FK)
CREATE TABLE outbound_orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    customer_id INT NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    required_ship_date DATE,
    actual_ship_date DATE,
    status VARCHAR(50) DEFAULT 'New',
    picked_by INT,
    shipped_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (picked_by) REFERENCES users(user_id),
    FOREIGN KEY (shipped_by) REFERENCES users(user_id),
    UNIQUE (warehouse_id, order_number)
);

-- 12. Outbound Items (linked via order_id and location_id)
CREATE TABLE outbound_items (
    outbound_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    ordered_quantity INT NOT NULL,
    picked_quantity INT DEFAULT 0,
    packed_quantity INT DEFAULT 0,
    shipped_quantity INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Pending',
    picked_from_location_id INT,
    batch_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES outbound_orders(order_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (picked_from_location_id) REFERENCES warehouse_locations(location_id)
);

-- Add some initial data for testing (including warehouses, users with global admin, customers, suppliers)
INSERT INTO warehouses (warehouse_name, address, city, is_active) VALUES
('Main Warehouse', '123 Warehouse Rd', 'Anytown', TRUE),
('Distribution Center A', '456 Industrial Blvd', 'Otherville', TRUE);

-- Initial users: admin is global admin, operator1 is a regular user
INSERT INTO users (username, password_hash, full_name, is_global_admin) VALUES
('admin', '$2y$10$C8YQ.JzT3uGz9i5B0mX3b.j0v7cQ4W6k2.o.q.Z0Y5pQ7L8V9A1X', 'Global Admin', TRUE), -- Password: password
('operator1', '$2y$10$C8YQ.JzT3uGz9i5B0mX3b.j0v7cQ4W6k2.o.q.Z0Y5pQ7L8V9A1X', 'John Doe', FALSE); -- Password: password

-- Assign operator1 to Main Warehouse with 'operator' role
-- Get warehouse_id for 'Main Warehouse' and user_id for 'operator1'
INSERT INTO user_warehouse_roles (user_id, warehouse_id, role) VALUES
(
    (SELECT user_id FROM users WHERE username = 'operator1'),
    (SELECT warehouse_id FROM warehouses WHERE warehouse_name = 'Main Warehouse'),
    'operator'
);
-- Assign operator1 to Distribution Center A with 'viewer' role (example of different role)
INSERT INTO user_warehouse_roles (user_id, warehouse_id, role) VALUES
(
    (SELECT user_id FROM users WHERE username = 'operator1'),
    (SELECT warehouse_id FROM warehouses WHERE warehouse_name = 'Distribution Center A'),
    'viewer'
);


INSERT INTO customers (customer_name, email, phone, address_line1, city, country) VALUES
('ABC Retail Inc.', 'contact@abcretail.com', '123-456-7890', '123 Main St', 'Anytown', 'USA'),
('XYZ Distributors', 'info@xyzdist.net', '987-654-3210', '456 Oak Ave', 'Otherville', 'Canada');

INSERT INTO suppliers (supplier_name, contact_person, email, phone, city, payment_terms, is_active) VALUES
('Global Supply Co.', 'Sarah Chen', 'sarah@globalsupply.com', '555-111-2222', 'New York', 'Net 30', TRUE),
('Tech Parts Inc.', 'David Lee', 'david@techparts.com', '555-333-4444', 'Los Angeles', 'COD', TRUE);


INSERT INTO products (sku, product_name, barcode, unit_of_measure) VALUES
('TIRE-RADIAL-17', 'Radial Tire 205/55R17', '1234567890123', 'EA'),
('TIRE-WINTER-16', 'Winter Tire 195/65R16', '9876543210987', 'EA'),
('TIRE-TRUCK-22', 'Truck Tire 295/80R22.5', '1122334455667', 'EA');

-- Warehouse locations (now associated with a warehouse_id, with example capacities)
INSERT INTO warehouse_locations (warehouse_id, location_code, location_type, max_capacity_units) VALUES
(1, 'A1-01-01', 'shelf', 50), -- Main Warehouse, capacity 50 units
(1, 'A1-01-02', 'shelf', 100),
(1, 'REC-01', 'receiving_bay', NULL), -- Receiving bay, no fixed unit capacity
(2, 'DCB-R1-S1', 'shelf', 75), -- Distribution Center A, capacity 75 units
(2, 'DCB-REC-01', 'receiving_bay', NULL);

-- Example inventory (now associated with a warehouse_id and specific locations)
INSERT INTO inventory (warehouse_id, product_id, location_id, quantity, batch_number) VALUES
(1, 1, 1, 10, 'BATCH001'), -- Radial Tires in Main Warehouse A1-01-01 (Capacity 50, Occupied 10)
(1, 2, 2, 5, 'BATCH002'),  -- Winter Tires in Main Warehouse A1-01-02 (Capacity 100, Occupied 5)
(2, 1, 4, 20, 'BATCH001DC'); -- Radial Tires in DC A DCB-R1-S1 (Capacity 75, Occupied 20)

-- Example inbound receipts (now associated with a warehouse_id and supplier_id)
INSERT INTO inbound_receipts (warehouse_id, receipt_number, supplier_id, supplier_name, expected_arrival_date, status, received_by) VALUES
(1, 'REC-MW-001', 1, 'Global Supply Co.', '2024-06-30', 'Pending', 1), -- Main Warehouse, from Global Supply
(2, 'REC-DCB-001', 2, 'Tech Parts Inc.', '2024-07-05', 'Pending', 1); -- DC A, from Tech Parts Inc.

-- Example outbound orders
INSERT INTO outbound_orders (warehouse_id, order_number, customer_id, required_ship_date, status, picked_by) VALUES
(1, 'ORD-MW-001', 1, '2024-06-25', 'New', NULL),
(2, 'ORD-DCB-001', 2, '2024-07-01', 'New', NULL);
