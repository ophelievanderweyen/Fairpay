-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:3306
-- Généré le : mar. 19 mai 2026 à 20:27
-- Version du serveur : 10.11.14-MariaDB-0ubuntu0.24.04.1
-- Version de PHP : 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `ebus2_projet03_aarr19`
--

-- --------------------------------------------------------

--
-- Structure de la table `expenses`
--

CREATE TABLE `expenses` (
  `id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `payer_id` int(11) NOT NULL,
  `amount` decimal(8,2) NOT NULL,
  `expense_date` date NOT NULL,
  `reason` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `expenses`
--

INSERT INTO `expenses` (`id`, `group_id`, `payer_id`, `amount`, `expense_date`, `reason`) VALUES
(16, 3, 7, 12.00, '2026-04-14', 'Réunion'),
(17, 14, 6, 50.00, '2026-04-01', 'Diesel'),
(18, 14, 8, 400.00, '2026-05-03', 'Hotels'),
(19, 8, 11, 5000.00, '2026-04-02', 'Hôtel'),
(21, 14, 7, 1200.00, '2026-05-17', 'billets avion'),
(22, 14, 11, 20.00, '2026-05-15', 'Gelatoooooo'),
(23, 14, 7, 75.00, '2026-04-05', 'Musée');

-- --------------------------------------------------------

--
-- Structure de la table `expense_participants`
--

CREATE TABLE `expense_participants` (
  `expense_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `expense_participants`
--

INSERT INTO `expense_participants` (`expense_id`, `user_id`) VALUES
(16, 6),
(16, 7),
(16, 8),
(16, 11),
(17, 6),
(17, 7),
(17, 8),
(17, 11),
(18, 6),
(18, 7),
(18, 8),
(18, 11),
(19, 6),
(19, 7),
(19, 8),
(19, 11);

-- --------------------------------------------------------

--
-- Structure de la table `groups`
--

CREATE TABLE `groups` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `groups`
--

INSERT INTO `groups` (`id`, `name`, `description`, `created_by`, `created_at`) VALUES
(3, 'Mcdo', '', 1, '2026-03-24 14:32:38'),
(8, 'Welcome toooo dxb bébé', '', 1, '2026-03-30 12:19:27'),
(10, 'Paris septembre', '', 7, '2026-05-03 14:15:28'),
(14, 'vacances italie', '', 7, '2026-05-03 16:08:49');

-- --------------------------------------------------------

--
-- Structure de la table `participations`
--

CREATE TABLE `participations` (
  `user_id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `participations`
--

INSERT INTO `participations` (`user_id`, `group_id`) VALUES
(6, 3),
(6, 8),
(6, 10),
(6, 14),
(7, 3),
(7, 8),
(7, 10),
(7, 14),
(8, 3),
(8, 8),
(8, 10),
(8, 14),
(11, 3),
(11, 8),
(11, 10),
(11, 14);

-- --------------------------------------------------------

--
-- Structure de la table `settlements`
--

CREATE TABLE `settlements` (
  `id` int(11) NOT NULL,
  `group_id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) NOT NULL,
  `amount` decimal(8,2) NOT NULL,
  `settlement_date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `settlements`
--

INSERT INTO `settlements` (`id`, `group_id`, `sender_id`, `receiver_id`, `amount`, `settlement_date`) VALUES
(1, 14, 6, 8, 62.50, '2026-05-13'),
(2, 14, 6, 8, 62.50, '2026-05-13');

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`) VALUES
(6, 'Aurélie Raquet', 'aurelie.raquet@gmail.com', '$2y$10$dPjtX2bOufk0OEBW80wQrO0tgOrCTpqUwkfr7xXWjtiNkG6o8JSLe'),
(7, 'malehou kawthar', 'malehoukawthar@gmail.com', '$2y$10$wPdbNZ0KMq5e4hv2vOe//eHAGybunFSohxdQ/XVXfpAOGAEAivtma'),
(8, 'ophé', 'ophelievanderweyen010@gmail.com', '$2y$10$B.ztszgK7N2xq0hxUn0.muzL40w0.oct2tb6.50xiy0DHArzx2a2m'),
(11, 'Simon C', 'simoncogo@gmail.com', '$2y$10$des3G1KQFJVx0YGb75ZnZOWkCO56aDzEeN/x5bOeq9SACpPeuLVyS'),
(13, 'elisa', 'elisa@hepl.be', '$2y$10$HNXdkmWOzl5akYJuaFZ4tOHztUG/gUztK6zjPLR/JYJqKiA9bJgGK'),
(14, 'philippe.bajoit@gmail.com', 'philippe.bajoit@gmail.com', '$2y$10$0jOemAGXzQweJsSni8iQMuGwzqLX4KWuUAMTye0FN4W8pfMgNeGu6');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `group_id` (`group_id`),
  ADD KEY `payer_id` (`payer_id`);

--
-- Index pour la table `expense_participants`
--
ALTER TABLE `expense_participants`
  ADD PRIMARY KEY (`expense_id`,`user_id`);

--
-- Index pour la table `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `participations`
--
ALTER TABLE `participations`
  ADD PRIMARY KEY (`user_id`,`group_id`),
  ADD KEY `group_id` (`group_id`);

--
-- Index pour la table `settlements`
--
ALTER TABLE `settlements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `group_id` (`group_id`),
  ADD KEY `sender_id` (`sender_id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `expenses`
--
ALTER TABLE `expenses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT pour la table `groups`
--
ALTER TABLE `groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT pour la table `settlements`
--
ALTER TABLE `settlements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  ADD CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`payer_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `participations`
--
ALTER TABLE `participations`
  ADD CONSTRAINT `participations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `participations_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`);

--
-- Contraintes pour la table `settlements`
--
ALTER TABLE `settlements`
  ADD CONSTRAINT `settlements_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`),
  ADD CONSTRAINT `settlements_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
