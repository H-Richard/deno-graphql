import { Application } from "https://deno.land/x/oak/mod.ts";
import { applyGraphQL, gql } from "https://deno.land/x/oak_graphql/mod.ts";
import { MongoClient, ObjectId } from "https://deno.land/x/mongo@v0.7.0/mod.ts";

const client = new MongoClient();
client.connectWithUri("mongodb://localhost:27017");

const db = client.database("test");
const dogs = db.collection("dogs");


const app = new Application();

app.use(async (ctx, next) => {
    await next();
    const rt = ctx.response.headers.get("X-Response-Time");
    console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

// @ts-ignore
const typeDefs = gql`
    type Dog {
        name: String!
        isGoodBoi: Boolean!
        id: ID!
    }

    input DogInput {
        name: String!
        isGoodBoi: Boolean!
    }

    type Query {
        foo: String!
        dog: [Dog!]!
        getDog(id: ID!): Dog
    }

    type Mutation {
        addDog(input: DogInput): Dog!
    }
`;

const resolvers = {
    Query: {
        foo: () => "bar",
        dog: async () => {
            const doggos = await dogs.find();
            return doggos.map((doggo: any) => {
                const { _id: { "\$oid": id } } = doggo;
                doggo.id = id;
                return doggo;
            });
        },
        getDog: async (_: any, { id }: any, context: any, info: any) => {
            const dogId = ObjectId(id);
            const doggo = await dogs.findOne(dogId);
            return { ...doggo, id };
        }
    },
    Mutation: {
        addDog: async (_: any, { input: { name, isGoodBoi } }: any, context: any, info: any) => {
            const { "\$oid": id } = await dogs.insertOne({ name, isGoodBoi });
            return { name, isGoodBoi, id };
        }
    }
};

const GraphQLService = await applyGraphQL({
    typeDefs,
    resolvers
});

app.use(GraphQLService.routes(), GraphQLService.allowedMethods());

const port = 8080;
console.log(`Server started on http://localhost:${port}`);
await app.listen({ port });