---
タイトル: Use Supabase with Spring Boot
URL: https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot
カテゴリ: getting-started
更新日: 2026-08-02
タグ: boot, getting-started, quickstarts, spring, spring-boot, supabase, with
---

# Use Supabase with Spring Boot

**URL:** https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot
**カテゴリ:** getting-started
**更新日:** 2026-08-02
**タグ:** boot, getting-started, quickstarts, spring, spring-boot, supabase, with

## 目次

- [Prerequisites#](#prerequisites)
- [1. Create a Spring Boot project#](#1-create-a-spring-boot-project)
- [2. Install Supabase's Agent Skills (optional)#](#2-install-supabases-agent-skills-optional)
- [3. Set up the Postgres connection details#](#3-set-up-the-postgres-connection-details)
- [4. Change the default schema#](#4-change-the-default-schema)
- [5. Create an entity and repository#](#5-create-an-entity-and-repository)
- [6. Seed sample data#](#6-seed-sample-data)
- [7. Query data from the app#](#7-query-data-from-the-app)
- [8. Start the app#](#8-start-the-app)
- [Next steps#](#next-steps)

## 概要

Learn how to create a Spring Boot project and connect it to your Supabase project.

---

AI Prompt

Help me add Supabase to my Spring Boot project. Create a Supabase project at database.new. Then: 1\. Run `curl https://start.spring.io/starter.zip -d dependencies=web,data-jpa,postgresql -d type=maven-project -d language=java -d groupId=com.example -d artifactId=instruments -d name=instruments -o instruments.zip` and unzip it to scaffold the project. 2\. Copy the JDBC connection string for the Session pooler (port 5432) from the Supabase Connect panel and export it as a `SUPABASE_DB_URL` environment variable, so the password stays out of source control. Set `spring.datasource.url=${SUPABASE_DB_URL}` and `spring.datasource.driver-class-name` in `application.properties`. Avoid the Transaction pooler (port 6543) since Hibernate relies on prepared statements. 3\. Set `spring.jpa.hibernate.ddl-auto=update` and `spring.jpa.properties.hibernate.default_schema` in `application.properties`, so Hibernate creates tables outside the `public` schema that Supabase exposes as a data API. 4\. Create an `Instrument` JPA entity mapped to the `instruments` table with `@Table(name = "instruments")`, and an `InstrumentRepository` extending `JpaRepository`. 5\. Add a `CommandLineRunner` bean to `InstrumentsApplication` that seeds the table with a few instruments the first time the app starts. 6\. Create an `InstrumentController` with a `GET /instruments` endpoint that returns `instrumentRepository.findAll()`. 7\. Run `./mvnw spring-boot:run` and open http://localhost:8080/instruments. REFERENCE https://supabase.com/docs/guides/getting-started/quickstarts/spring-boot.md

Show more

## Prerequisites#

Before you begin, make sure you have:

  * Java 17 or later, which you can check with `java -version`
  * `curl` and `unzip`, to download and extract the generated project


## 1\. Create a Spring Boot project#

Use [Spring Initializr](<https://start.spring.io>) to scaffold a new project with the Web, Spring Data JPA, and Postgres Driver dependencies. Run the following from the directory where you keep your projects.
[code] 
    1
    
    curl https://start.spring.io/starter.zip \
    
    2
    
      -d dependencies=web,data-jpa,postgresql \
    
    3
    
      -d type=maven-project \
    
    4
    
      -d language=java \
    
    5
    
      -d groupId=com.example \
    
    6
    
      -d artifactId=instruments \
    
    7
    
      -d name=instruments \
    
    8
    
      -o instruments.zip
    
    9
    
    unzip instruments.zip -d instruments && cd instruments
[/code]

## 2\. Install Supabase's Agent Skills (optional)#

Supabase's [Agent Skills](</docs/guides/ai-tools/ai-skills>) is a curated set of instructions that give your AI agent procedural knowledge about working with Supabase.

Install them so your AI coding agent can produce more accurate, reliable code using current Supabase patterns, such as authentication, server-side rendering, and database migrations, rather than relying solely on training data.

To install, run the following command in the root of your project:
[code] 
    1
    
    npx skills add supabase/agent-skills
[/code]

## 3\. Set up the Postgres connection details#

Go to [database.new](<https://database.new>) and create a new Supabase project. Save your database password securely.

When your project is up and running, navigate to its dashboard and click on [Connect](</dashboard/project/_?showConnect=true&method=session>).

The Transaction pooler (port `6543`) doesn't work as your app's main data source, because Spring Data JPA uses Hibernate, which relies on server-side prepared statements. Use the Session pooler, or the direct connection string if you're in an [IPv6 environment](</docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP>) or have the [IPv4 Add-On](</docs/guides/platform/ipv4-address>).

Under the **Session pooler** (port `5432`), select the **JDBC** tab and copy the connection string. Replace the password placeholder with your saved database password, and [percent-encode](<https://en.wikipedia.org/wiki/Percent-encoding>) any reserved characters it contains, such as `&`, `#`, `?`, or a space.

You can reset your database password in your [Database Settings](</dashboard/project/_/database/settings>) if you do not have it.

The connection string contains your database password, and `application.properties` is committed with your project. Set the string as an environment variable instead, and set it the same way on whatever platform you deploy to.
[code] 
    1
    
    export SUPABASE_DB_URL='jdbc:postgresql://xxxx.pooler.supabase.com:5432/postgres?user=postgres.xxxx&password=[YOUR-PASSWORD]&sslmode=require'
[/code]

The string you copied doesn't set `sslmode`, so add it. The driver defaults to `prefer`, which falls back to sending your data in plaintext if the encrypted attempt fails. You can also [enforce SSL](</docs/guides/platform/ssl-enforcement>) on the database side.

Then reference the variable, along with the driver, in `src/main/resources/application.properties`.

src/main/resources/application.properties
[code]
    1
    
    spring.datasource.url=${SUPABASE_DB_URL}
    
    2
    
    spring.datasource.driver-class-name=org.postgresql.Driver
    
    3
    
    spring.jpa.hibernate.ddl-auto=update
[/code]

If the app fails to start with `Unable to determine Dialect without JDBC metadata`, Hibernate couldn't open a connection at all. Look above that line in the logs for the real cause, most commonly `password authentication failed`.

## 4\. Change the default schema#

By default Hibernate creates tables in the `public` schema. We recommend changing this as Supabase exposes the `public` schema as a [data API](</docs/guides/api>).

Create the schema from the [Table Editor](</dashboard/project/_/editor>) as your app will need it before start. Then point **Hibernate** at it in `application.properties`.

src/main/resources/application.properties
[code]
    1
    
    spring.jpa.properties.hibernate.default_schema=app
[/code]

## 5\. Create an entity and repository#

Spring Data JPA maps Java classes to database tables. Create an `Instrument` entity in `src/main/java/com/example/instruments/Instrument.java`. With `spring.jpa.hibernate.ddl-auto=update` set, Hibernate creates the `instruments` table for you when the app starts.

src/main/java/com/example/instruments/Instrument.java
[code]
    1
    
    package com.example.instruments;
    
    2
    
    3
    
    import jakarta.persistence.Entity;
    
    4
    
    import jakarta.persistence.GeneratedValue;
    
    5
    
    import jakarta.persistence.GenerationType;
    
    6
    
    import jakarta.persistence.Id;
    
    7
    
    import jakarta.persistence.Table;
    
    8
    
    9
    
    @Entity
    
    10
    
    @Table(name = "instruments")
    
    11
    
    public class Instrument {
    
    12
    
    13
    
        @Id
    
    14
    
        @GeneratedValue(strategy = GenerationType.IDENTITY)
    
    15
    
        private Long id;
    
    16
    
    17
    
        private String name;
    
    18
    
    19
    
        public Instrument() {}
    
    20
    
    21
    
        public Instrument(String name) {
    
    22
    
            this.name = name;
    
    23
    
        }
    
    24
    
    25
    
        public Long getId() {
    
    26
    
            return id;
    
    27
    
        }
    
    28
    
    29
    
        public String getName() {
    
    30
    
            return name;
    
    31
    
        }
    
    32
    
    33
    
        public void setName(String name) {
    
    34
    
            this.name = name;
    
    35
    
        }
    
    36
    
    }
[/code]

Create an `InstrumentRepository` interface in the same package. Extending `JpaRepository` gives you `findAll`, `save`, and other query methods without writing any implementation.

src/main/java/com/example/instruments/InstrumentRepository.java
[code]
    1
    
    package com.example.instruments;
    
    2
    
    3
    
    import org.springframework.data.jpa.repository.JpaRepository;
    
    4
    
    5
    
    public interface InstrumentRepository extends JpaRepository<Instrument, Long> {}
[/code]

## 6\. Seed sample data#

Add a `CommandLineRunner` bean to `InstrumentsApplication.java` that saves some sample instruments the first time the app starts.

src/main/java/com/example/instruments/InstrumentsApplication.java
[code]
    1
    
    package com.example.instruments;
    
    2
    
    3
    
    import org.springframework.boot.CommandLineRunner;
    
    4
    
    import org.springframework.boot.SpringApplication;
    
    5
    
    import org.springframework.boot.autoconfigure.SpringBootApplication;
    
    6
    
    import org.springframework.context.annotation.Bean;
    
    7
    
    8
    
    @SpringBootApplication
    
    9
    
    public class InstrumentsApplication {
    
    10
    
    11
    
        public static void main(String[] args) {
    
    12
    
            SpringApplication.run(InstrumentsApplication.class, args);
    
    13
    
        }
    
    14
    
    15
    
        @Bean
    
    16
    
        CommandLineRunner seedInstruments(InstrumentRepository instrumentRepository) {
    
    17
    
            return args -> {
    
    18
    
                if (instrumentRepository.count() == 0) {
    
    19
    
                    instrumentRepository.save(new Instrument("violin"));
    
    20
    
                    instrumentRepository.save(new Instrument("viola"));
    
    21
    
                    instrumentRepository.save(new Instrument("cello"));
    
    22
    
                }
    
    23
    
            };
    
    24
    
        }
    
    25
    
    }
[/code]

## 7\. Query data from the app#

Create an `InstrumentController` that fetches every row from the `instruments` table through the repository and returns it as JSON.

src/main/java/com/example/instruments/InstrumentController.java
[code]
    1
    
    package com.example.instruments;
    
    2
    
    3
    
    import java.util.List;
    
    4
    
    5
    
    import org.springframework.web.bind.annotation.GetMapping;
    
    6
    
    import org.springframework.web.bind.annotation.RestController;
    
    7
    
    8
    
    @RestController
    
    9
    
    public class InstrumentController {
    
    10
    
    11
    
        private final InstrumentRepository instrumentRepository;
    
    12
    
    13
    
        public InstrumentController(InstrumentRepository instrumentRepository) {
    
    14
    
            this.instrumentRepository = instrumentRepository;
    
    15
    
        }
    
    16
    
    17
    
        @GetMapping("/instruments")
    
    18
    
        public List<Instrument> getInstruments() {
    
    19
    
            return instrumentRepository.findAll();
    
    20
    
        }
    
    21
    
    }
[/code]

## 8\. Start the app#

Run the Spring Boot app, and go to <http://localhost:8080/instruments>[](<http://localhost:8080/instruments>) in your browser. You should see the list of instruments.
[code] 
    1
    
    ./mvnw spring-boot:run
[/code]

## Next steps#

  * Set up [Auth](</docs/guides/auth>) for your app
  * Replace `ddl-auto` with [database migrations](</docs/guides/deployment/database-migrations>) before going to production
  * [Insert more data](</docs/guides/database/import-data>) into your database
  * Upload and serve static files using [Storage](</docs/guides/storage>)