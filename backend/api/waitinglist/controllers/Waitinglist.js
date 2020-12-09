"use strict";

const ObjectId = require("bson-objectid");
const {
  WAITING_LIST_STATUS_CONFIRMED,
  WAITING_LIST_STATUS_CANCELED,
  WAITING_LIST_TYPE_WALKINS,
  WAITING_LIST_TYPE_APPOINTMENT,
  WAITING_LIST_TYPE_RESERVED,
  WAITING_LIST_STATUS_NOT_CONFIRMED,
} = require("../../constants");

const Joi = require("@hapi/joi");

/**
 * Waitinglist.js controller
 *
 * @description: A set of functions called "actions" for managing `Waitinglist`.
 */

const moment = require("moment");
const _ = require("lodash");

module.exports = {
  //TODO: Create `policy` to validate if user object is presented in state

  ownLists: async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [
        { messages: [{ id: "No authorization header was found" }] },
      ]);
    }
    const anyoneUserProfile = await strapi.services.accounts.getAnyoneEmployee();
    let filters = {};
    try {
      filters = JSON.parse(_.get(ctx.query, "filters"));
    } catch (e) {}
    const filter = {
      dateFrom: _.get(filters, "all.dateFrom"),
      dateTo: _.get(filters, "all.dateTo") || moment().add(1, "year").unix(), // hacky but works
      employees: [
        { id: anyoneUserProfile.id, name: anyoneUserProfile.username },
        { id: user.id, name: user.username },
      ],
    };

    ctx.query = {
      ...ctx.query,
      filters: {
        all: filter,
        recent: filter,
        checked: filter,
        calendar: {
          user: {
            id: user.id,
          },
        },
      },
    };
    return strapi.controllers.waitinglist.find(ctx);
  },

  changeOwnDayStatus: async (ctx) => {
    const user = ctx.user.state;
    if (!user) {
      return ctx.badRequest(null, [
        { messages: [{ id: "No authorization header was found" }] },
      ]);
    }
    ctx.request.body = {
      ...ctx.request.body,
      id: _.get(ctx, "user.state.id"),
    };
    return strapi.controllers.waitinglist.changeDayStatus(ctx);
  },

  ownUpdate: async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [
        { messages: [{ id: "No authorization header was found" }] },
      ]);
    }

    return strapi.services.joi
      .validate({ ...ctx.params, ...ctx.request.body })
      .objectId("id")
      .employees()
      .result()
      .then(async (data) => {
        const record = await strapi.services.waitinglist.fetch({
          _id: data.id,
        });

        if (!record) return ctx.notFound();
        const anyoneUserProfile = await strapi.services.accounts.getAnyoneEmployee();

        const canEdit = data.employees.some((el) =>
          [user.id, anyoneUserProfile.id].includes(el.id)
        );

        if (!canEdit) return ctx.notFound();
        return strapi.controllers.waitinglist.update(ctx);
      })
      .catch((e) => {
        if (e.message)
          strapi.log.error("waitinglist.ownUpdate Error: %s", e.message);
        ctx.notFound();
      });
  },

  ownCreate: async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [
        { messages: [{ id: "No authorization header was found" }] },
      ]);
    }

    if (_.isEmpty(ctx.request.body.employees)) {
      ctx.request.body["employees"] = [user.username];
    }

    const employees = _.get(ctx, "request.body.employees", []);
    // const anyoneUserProfile = await strapi.services.accounts.getAnyoneEmployee();

    const canCreate = employees.some((el) => [user.username].includes(el));
    if (!canCreate) return ctx.notFound();
    return strapi.controllers.waitinglist.create(ctx);
  },

  ownFindOne: async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [
        { messages: [{ id: "No authorization header was found" }] },
      ]);
    }
    return strapi.services.joi
      .validate(ctx.params)
      .objectId("id")
      .result()
      .then(async (data) => {
        const anyoneUserProfile = await strapi.services.accounts.getAnyoneEmployee();

        const record = await strapi.services.waitinglist.fetch({
          _id: data.id,
        });
        if (!record) return ctx.notFound();

        const canEdit = record.employees.some((el) =>
          [user.id, anyoneUserProfile.id].includes(el.id)
        );
        if (!canEdit) return ctx.notFound();
        return strapi.controllers.waitinglist.findOne(ctx);
      })
      .catch((e) => {
        if (e.message)
          strapi.log.error("waitinglist.ownFindOne Error: %s", e.message);
        ctx.notFound();
      });
  },

  ownToggleProperty: async (ctx) => {
    const user = ctx.state.user;
    if (!user) {
      return ctx.badRequest(null, [
        { messages: [{ id: "No authorization header was found" }] },
      ]);
    }
    return strapi.services.joi
      .validate(ctx.params)
      .objectId("id")
      .result()
      .then(async (data) => {
        const anyoneUserProfile = await strapi.services.accounts.getAnyoneEmployee();

        const record = await strapi.services.waitinglist.fetch({
          _id: data.id,
        });
        if (!record) return ctx.notFound();

        const canEdit = record.employees.some((el) =>
          [user.id, anyoneUserProfile.id].includes(el.id)
        );
        if (!canEdit) return ctx.notFound();
        return strapi.controllers.waitinglist.toggleProperty(ctx);
      })
      .catch((e) => {
        if (e.message)
          strapi.log.error(
            "waitinglist.ownToggleProperty Error: %s",
            e.message
          );
        ctx.notFound();
      });
  },

  changeDayStatus: async (ctx) => {
    return strapi.services.joi
      .validate(ctx.request.body)
      .objectId("id")
      .boolean("status")
      .number("timestamp", { error: "Wrong date provided" })
      .result()
      .then(async (values) => {
        const account = await strapi.services.accounts.fetch({
          id: values.accountId,
        });
        if (!account) return ctx.notFound();
        return strapi.services.appointments.changeDayStatus(
          values.accountId,
          timestamp,
          status
        );
      })
      .catch((e) =>
        strapi.services.utils.errorHandler(
          "waitingList.toggleDayStatus",
          e,
          ctx
        )
      );
  },

  /**
   * Retrieve waitinglist records.
   *
   * @return {Object|Array}
   */

  find: async (ctx) => {
    return strapi.services.joi
      .validate(ctx.query)
      .number("page", { optional: true, positive: true })
      .number("viewDate", { optional: true, positive: true })
      .filter(
        "filters",
        {
          all: {
            dateFrom: Joi.number().min(1).integer(),
            dateTo: Joi.number().min(1).integer(),
            pageSize: Joi.number().min(4).max(50).integer(),
            employees: Joi.array().items(
              Joi.object({
                id: Joi.string()
                  .regex(/^[0-9a-fA-F]{24}$/)
                  .error(() => "Wrong employee provided"),
                name: Joi.string(), // Any string is good since we do not use it, add a validation if you need usernames
              })
            ),
          },
          recent: {
            dateFrom: Joi.number().min(1).integer(),
            dateTo: Joi.number().min(1).integer(),
            pageSize: Joi.number().min(4).max(50).integer(),
            employees: Joi.array().items(
              Joi.object({
                id: Joi.string()
                  .regex(/^[0-9a-fA-F]{24}$/)
                  .error(() => "Wrong employee provided"),
                name: Joi.string(), // Any string is good since we do not use it, add a validation if you need usernames
              })
            ),
          },
          checked: {
            dateFrom: Joi.number().min(1).integer(),
            dateTo: Joi.number().min(1).integer(),
            pageSize: Joi.number().min(4).max(50).integer(),
            employees: Joi.array().items(
              Joi.object({
                id: Joi.string()
                  .regex(/^[0-9a-fA-F]{24}$/)
                  .error(() => "Wrong employee provided"),
                name: Joi.string(), // Any string is good since we do not use it, add a validation if you need usernames
              })
            ),
          },
          calendar: {
            user: {
              id: Joi.string()
                .regex(/^[0-9a-fA-F]{24}$/)
                .error(() => "Wrong employee provided"),
            },
          },
        },
        { optional: true }
      )
      .isIn("listType", ["all", "recent", "checked", "appointments"], {
        optional: true,
      })
      .result()
      .then(async (values) => {
        const filter = _.get(values, "filters.all", {});
        const showAll = _.get(values, "filters.all.showAll");
        const dateFrom = _.get(values, "filters.all.dateFrom");
        const dateTo = _.get(values, "filters.all.dateTo");
        strapi.io.sockets.emit(
          "queue.setEmployees",
          await strapi.controllers.queue.getEmployees()
        );
        const listType = values.listType || "all";
        let recent = { clients: [] };
        let checked = { clients: [] };
        let appointments = { clients: [] };

        if (listType === "recent" || listType === "all") {
          const filter = _.get(values, "filters.recent", {});
          const employees =
            Array.isArray(filter.employees) &&
            filter.employees.length > 0 &&
            filter.employees.map((el) => ({ employees: ObjectId(el.id) }));
          recent =
            (await strapi.services.waitinglist.getList(
              {
                createdAt: {
                  ...(dateFrom
                    ? { $gte: moment.unix(dateFrom).startOf("day") }
                    : { $gte: strapi.services.time.startOfDay() }),
                  // $lt: strapi.services.time.now().add(showInWaitingListTime.id, 'seconds').toDate(),
                  // $lt: strapi.services.time.endOfDay(),
                  ...(dateTo
                    ? { $lt: moment.unix(dateTo).endOf("day") }
                    : { $lt: strapi.services.time.endOfDay() }),
                  ...(dateFrom &&
                    !dateTo && { $lt: moment.unix(dateFrom).endOf("day") }),
                },
                type: WAITING_LIST_TYPE_WALKINS,
                check: false,
                ...(employees && { $or: employees }),
              },
              values,
              { apptStarTime: -1, createdAt: 1 }
            )) || {};

          if (listType === "recent") return { recent };
        }
        if (listType === "checked" || listType === "all") {
          const filter = _.get(values, "filters.checked", {});
          const employees =
            Array.isArray(filter.employees) &&
            filter.employees.length > 0 &&
            filter.employees.map((el) => ({ employees: ObjectId(el.id) }));

          checked =
            (await strapi.services.waitinglist.getList(
              {
                updatedAt: {
                  ...(dateFrom
                    ? { $gte: moment.unix(dateFrom).startOf("day") }
                    : { $gte: strapi.services.time.startOfDay() }),
                  // $lt: strapi.services.time.now().add(showInWaitingListTime.id, 'seconds').toDate(),
                  // $lt: strapi.services.time.endOfDay(),
                  ...(dateTo
                    ? { $lt: moment.unix(dateTo).endOf("day") }
                    : { $lt: strapi.services.time.endOfDay() }),
                  ...(dateFrom &&
                    !dateTo && { $lt: moment.unix(dateFrom).endOf("day") }),
                },
                // updatedAt: {
                //   $gte: strapi.services.time.startOfDay(),
                //   ...!showAll && { $lt: strapi.services.time.endOfDay() },
                // },
                check: true,
                ...(employees && { $or: employees }),
              },
              values,
              { updatedAt: -1 }
            )) || {};

          if (listType === "checked") return { checked };
        }

        if (listType === "appointments" || listType === "all") {
          const employees =
            Array.isArray(filter.employees) &&
            filter.employees.length > 0 &&
            filter.employees.map((el) => ({ employees: ObjectId(el.id) }));
          // const showInWaitingListTime = await strapi.services.config.get('appointments').key('showInWaitingListTime');
          appointments =
            (await strapi.services.waitinglist.appointments(
              {
                type: WAITING_LIST_TYPE_APPOINTMENT,
                apptStartTime: {
                  ...(dateFrom
                    ? { $gte: moment.unix(dateFrom).startOf("day") }
                    : { $gte: strapi.services.time.startOfDay() }),
                  // $lt: strapi.services.time.now().add(showInWaitingListTime.id, 'seconds').toDate(),
                  // $lt: strapi.services.time.endOfDay(),
                  ...(dateTo
                    ? { $lt: moment.unix(dateTo).endOf("day") }
                    : { $lt: strapi.services.time.endOfDay() }),
                  ...(dateFrom &&
                    !dateTo && { $lt: moment.unix(dateFrom).endOf("day") }),
                },
                ...(employees && { $or: employees }),
              },
              values
            )) || {};
          if (listType === "appointments") return { appointments };
        }

        if (Array.isArray(recent.clients) && recent.clients.length > 0) {
          const lastElementIndex = recent.clients.length - 1;
          recent.clients[lastElementIndex] = {
            ...recent.clients[lastElementIndex]._doc,
            flash: true,
          };
        }

        const calendarUserId = _.get(values, "filters.calendar.user.id", false);

        const calendar = await strapi.services.appointments.calendar(
          calendarUserId,
          values.viewDate
        );
        return {
          appointments,
          recent,
          checked,
          calendar,
        };
      })
      .catch((e) =>
        strapi.services.utils.errorHandler("waitingList.find", e, ctx)
      );
  },

  /**
   * Retrieve a waitinglist record.
   *
   * @return {Object}
   */

  findOne: async (ctx) => {
    return strapi.services.joi
      .validate(ctx.params)
      .objectId("id")
      .result()
      .then((data) => {
        return strapi.services.waitinglist
          .fetch({ _id: data.id })
          .then(async (data) => {
            strapi.io.sockets.emit(
              "queue.setEmployees",
              await strapi.controllers.queue.getEmployees()
            );
            const waitingRecordData = data.toObject();
            const employeeId = _.get(
              waitingRecordData,
              "employees[0].id",
              undefined
            );

            return {
              ...waitingRecordData,
              ...((waitingRecordData.type === WAITING_LIST_TYPE_APPOINTMENT ||
                waitingRecordData.type === WAITING_LIST_TYPE_RESERVED) &&
                employeeId && {
                  timeline: await strapi.services.accounts.getTimeline(
                    employeeId,
                    moment(data.apptStartTime).unix(),
                    false
                  ),
                }),
              date: moment(waitingRecordData.apptStartTime).unix(),
              meta: {
                timeStep: await strapi.services.config
                  .get("appointments")
                  .key("timeStep"),
                items: await strapi.services.accounts.getServices(employeeId),
                allItems: await strapi.services.items.getAllItems(),
              },
            };
          });
      })
      .catch((e) => {
        if (e.message)
          strapi.log.error("waitinglist.findOne Error: %s", e.message);
        ctx.notFound();
      });
  },

  create: async (ctx) => {
    return (
      strapi.services.joi
        .validate(ctx.request.body)
        .dateRange("timeRange", { allowMultipleDates: false, allowNull: true })
        .services({ optional: true })
        .employees()
        .isIn("type", [
          WAITING_LIST_TYPE_RESERVED,
          WAITING_LIST_TYPE_APPOINTMENT,
          WAITING_LIST_TYPE_WALKINS,
        ])
        .string("note", {
          label: "Note",
          optional: true,
          regex: /^(?!-)(?!.*--)[A-Za-z0-9 -,.@]+(?<!-)$/,
        })
        .isIn("status", [
          WAITING_LIST_STATUS_NOT_CONFIRMED,
          WAITING_LIST_STATUS_CONFIRMED,
        ])
        .boolean("flag", { optional: true })
        .number("date", { min: strapi.services.time.unix().startOfDay })
        .string("user.firstName", {
          label: "First Name",
          startCase: true,
          allowEmpty:
            _.get(ctx.request.body, "type") === WAITING_LIST_TYPE_RESERVED,
        })
        .string("user.lastName", {
          label: "Last Name",
          startCase: true,
          allowEmpty:
            _.get(ctx.request.body, "type") === WAITING_LIST_TYPE_RESERVED,
        })
        .mobilePhone("user.mobilePhone", {
          optional: true,
          unique: !_.get(ctx.request.body, '["user.id"]'),
        })
        // if request.body has user id, there is no need to validate unique email, since we will link existing user
        .email({
          name: "user.email",
          optional: true,
          unique: !_.get(ctx.request.body, '["user.id"]'),
          mxValidation: true,
          checkBlacklists: true,
        })
        .objectId("user.id", { optional: true })
        .boolean("notifyClient", { optional: true })
        .boolean("notifyEmployee", { optional: true })
        .string("notifyClientNote", {
          label: "Client Note",
          optional: true,
          regex: /^[a-zA-Z0-9 !@\-()?.&#\r\n]*$/,
        })
        .string("notifyEmployeeNote", {
          label: "Employee Note",
          optional: true,
          regex: /^[a-zA-Z0-9 !@\-()?.&#\r\n]*$/,
        })
        .result()
        .then(async (values) => {
          const errors = {};
          let user;
          if (values.type !== WAITING_LIST_TYPE_RESERVED) {
            const userData = {
              id: values["user.id"] && ObjectId(values["user.id"]),
              firstName: values["user.firstName"],
              lastName: values["user.lastName"],
              mobilePhone: values["user.mobilePhone"],
              email: values["user.email"],
            };
            if (userData.id) {
              user = await strapi.services.accounts.fetch({ _id: userData.id });
              if (!user) return ctx.badRequest("Provided user id is incorrect");
            } else if (
              userData.firstName &&
              userData.lastName &&
              !userData.id
            ) {
              const clientRole = await strapi.services.accounts.getRoleByName(
                "Client"
              );
              const newUserData = {
                firstName: userData.firstName,
                lastName: userData.lastName,
                ...(userData.email && { email: userData.email }),
                ...(userData.mobilePhone && {
                  mobilePhone: userData.mobilePhone,
                }),
                blocked: false,
                role: clientRole._id,
              };
              user = await strapi.plugins[
                "users-permissions"
              ].services.user.add(newUserData);
              strapi.services.eventemitter.emit("accounts.create", user);
            } else {
              return ctx.badRequest("User account must be provided");
            }
          }

          const from = _.get(values, "timeRange[0][0]");
          const to = _.get(values, "timeRange[0][1]");

          if (values.type !== WAITING_LIST_TYPE_WALKINS) {
            // Only for clients who are walk-ins is allowed to select multiple employees
            if (values.employees.length > 1) {
              return ctx.badRequest(
                "Selected type cannot have multiple employees"
              );
            }

            // Date and time should be specified if it is not a walk-in
            if (
              !values.date ||
              !Array.isArray(values.timeRange) ||
              values.timeRange.length === 0
            ) {
              return ctx.badRequest("Please select correct date & time");
            }

            if (!from || !to) {
              return ctx.badRequest("Incorrect time was selected");
            }

            const timeline =
              (await strapi.services.accounts.getTimeline(
                _.get(values, "employees[0].id"),
                values.date
              )) || [];
            if (timeline.length === 0) {
              return ctx.badRequest(
                "Unable to find timeline for specified employee"
              );
            }

            const isEmployeeTimeAvailable = await strapi.services.accounts.isTimeAvailable(
              timeline,
              from,
              to
            );

            if (!isEmployeeTimeAvailable) {
              return ctx.badRequest("Selected time is no longer available");
            }
          }
          values.user = user;

          /**
           * If item was already checked (done) than do not update time or date, since it will not take any affect
           * because record was marked as done
           */
          return strapi.services.waitinglist
            .add(values)
            .then(async (WaitingListRecord) => {
              strapi.services.eventemitter.emit(
                "waitingList.create",
                WaitingListRecord,
                values,
                ctx
              );
              return {
                ...strapi.services.response.flash("Successfully created"),
                data: {
                  id: WaitingListRecord.id,
                },
              };
            });
        })
        .catch((e) =>
          strapi.services.utils.errorHandler("waitingList.create", e, ctx)
        )
    );
  },

  /**
   * Sends meta data for new records
   * @param ctx
   * @returns {Bluebird<R>}
   */
  newRecordMeta: async (ctx) => {
    return strapi.services.joi
      .validate(ctx.params)
      .result()
      .then(async () => {
        strapi.io.sockets.emit(
          "queue.setEmployees",
          await strapi.controllers.queue.getEmployees()
        );
        const allItems = await strapi.services.items.getAllItems();
        return {
          meta: {
            timeStep: await strapi.services.config
              .get("appointments")
              .key("timeStep"),
            allItems,
          },
        };
      })
      .catch((e) => {
        if (e.message) strapi.log.error("waitinglist.new Error: %s", e.message);
        ctx.notFound();
      });
  },

  ownNewRecordMeta: async (ctx) => {
    return strapi.controllers.waitinglist.newRecordMeta(ctx);
  },

  /**
   * Count waitinglist records.
   *
   * @return {Number}
   */

  count: async (ctx) => {
    return strapi.services.waitinglist.count(ctx.query);
  },

  /**
   * Register a waitinglist record.
   *
   * @return {Object}
   */

  register: async (ctx) => {
    const body = ctx.request.body;
    return strapi.services.joi
      .validate(body)
      .string("firstName", { label: "First Name", startCase: true })
      .string("lastName", { label: "Last Name", startCase: true })
      .email({
        optional: true,
        unique: true,
        mxValidation: true,
        checkBlacklists: true,
      })
      .isIn("skipSteps", ["fullName", "email", "employees"], { optional: true })
      .employees({ optional: true })
      .result()
      .then(async (data) => {
        const skipSteps = data.skipSteps || [];
        // Verify if user exists
        const user =
          (await strapi.services.accounts.fetch({
            firstName: data.firstName,
            lastName: data.lastName,
          })) || {};

        const askEmail = await strapi.services.config
          .get("waitinglist")
          .key("askEmail");
        const preSelectEmployees = await strapi.services.config
          .get("waitinglist")
          .key("preSelectEmployees");
        const allowSelectEmployee = await strapi.services.config
          .get("waitinglist")
          .key("allowSelectEmployee");

        if (
          askEmail &&
          skipSteps.indexOf("email") === -1 &&
          !data.email &&
          !user.email
        ) {
          return ctx.badRequest("No email was provided", {
            hasEmail: Boolean(user.email),
            nextStep: "email",
          });
        }

        if (!data.employees && allowSelectEmployee) {
          const allEmployees = await strapi.controllers.queue.getAllEmployees();
          const preferredEmployees = [];
          if (Array.isArray(allEmployees) && user.preferredEmployees) {
            user.preferredEmployees.map((emId) => {
              allEmployees.map((el) => {
                if (el.id === emId) preferredEmployees.push(el);
              });
            });
          }
          return ctx.badRequest("", {
            ...(user.preferredEmployees &&
              preSelectEmployees && {
                preferredEmployees: preferredEmployees,
              }),
            listOfEmployees: await strapi.controllers.queue.getEmployees(),
            hasEmail: askEmail ? Boolean(user.email) : true,
            ...(askEmail === false && { hasEmail: true }),
            nextStep: "employees",
          });
        }

        if (
          !allowSelectEmployee ||
          (Array.isArray(data.employees) && data.employees.length === 0)
        ) {
          const employees = await strapi.controllers.queue.getEmployees();
          data.employees = employees.enabled.filter(
            (el) => el.name === "Anyone"
          );
        }
        if (data.employees)
          data.preferredEmployees = data.employees
            .filter((el) => el.name !== "Anyone")
            .map((el) => el.id);
        let client;
        // Create accounts if does not exist
        if (!user.id) {
          const clientRole = await strapi.services.accounts.getRoleByName(
            "Client"
          );
          const newUserData = {
            firstName: data.firstName,
            lastName: data.lastName,
            ...(data.email && { email: data.email }),
            blocked: false,
            role: clientRole._id,
            ...(data.preferredEmployees.length > 0 && {
              preferredEmployees: data.preferredEmployees,
            }),
          };
          client = await strapi.plugins["users-permissions"].services.user.add(
            newUserData
          );
          strapi.services.eventemitter.emit("accounts.create", client);
        } else {
          client = user;
          const toUpdate = {
            preferredEmployees: data.preferredEmployees,
          };
          await strapi.plugins["users-permissions"].services.user.edit(
            { id: user.id },
            toUpdate
          );
        }
        const newClientRecord = {
          user: client,
          employees: data.employees,
          check: false,
          type: WAITING_LIST_TYPE_WALKINS,
          status: WAITING_LIST_STATUS_CONFIRMED,
        };
        return strapi.services.waitinglist
          .add(newClientRecord)
          .then(async (WaitingListRecord) => {
            strapi.services.eventemitter.emit(
              "waitingList.create",
              WaitingListRecord,
              data,
              ctx
            );
            return { message: "success" };
          });
      })
      .catch((e) =>
        strapi.services.utils.errorHandler("waitingList.register", e, ctx)
      );
  },

  /**
   * Update a/an waitinglist record.
   *
   * @return {Object}
   */

  update: async (ctx) => {
    return strapi.services.joi
      .validate({ ...ctx.params, ...ctx.request.body })
      .objectId("id")
      .isIn("type", [
        WAITING_LIST_TYPE_RESERVED,
        WAITING_LIST_TYPE_APPOINTMENT,
        WAITING_LIST_TYPE_WALKINS,
      ])
      .isIn("status", [
        WAITING_LIST_STATUS_NOT_CONFIRMED,
        WAITING_LIST_STATUS_CANCELED,
        WAITING_LIST_STATUS_CONFIRMED,
      ])
      .number("date", {
        optional: true,
        min: _.get(ctx.request, "body.check")
          ? false
          : strapi.services.time.unix().startOfDay,
        error: "Wrong date provided",
      })
      .dateRange("timeRange", { allowMultipleDates: false, allowNull: true })
      .boolean("flag", { optional: true })
      .boolean("check", { optional: true })
      .string("note", {
        label: "Note",
        optional: true,
        regex: /^(?!-)(?!.*--)[A-Za-z0-9 -,.@]+(?<!-)$/,
      })
      .employees()
      .services({ optional: true })
      .boolean("notifyClient", { optional: true })
      .boolean("notifyEmployee", { optional: true })
      .string("notifyClientNote", {
        label: "Client Note",
        optional: true,
        regex: /^[a-zA-Z0-9 !@\-()?.&#\r\n]*$/,
      })
      .string("notifyEmployeeNote", {
        label: "Employee Note",
        optional: true,
        regex: /^[a-zA-Z0-9 !@\-()?.&#\r\n]*$/,
      })
      .result()
      .then(async (data) => {
        const from = _.get(data, "timeRange[0][0]");
        const to = _.get(data, "timeRange[0][1]");

        if (
          data.type === WAITING_LIST_TYPE_APPOINTMENT &&
          data.employees.some((el) => {
            return el.name === "Anyone";
          })
        ) {
          return ctx.badRequest(
            "Assigning appointments to `Anyone` employee is not allowed at the moment "
          );
        }

        if (
          data.type !== WAITING_LIST_TYPE_WALKINS &&
          data.status !== WAITING_LIST_STATUS_CANCELED
        ) {
          // Only for clients who are walk-ins is allowed to select multiple employees
          if (data.employees.length > 1) {
            return ctx.badRequest(
              "Selected type cannot have multiple employees"
            );
          }

          // Date and time should be specified if it is not a walk-in
          if (
            (!data.date ||
              !Array.isArray(data.timeRange) ||
              data.timeRange.length === 0) &&
            !data.check
          ) {
            return ctx.badRequest("Please select correct date & time");
          }

          if ((!from || !to) && !data.check) {
            return ctx.badRequest("Incorrect time was selected");
          }

          if (!_.get(ctx.request, "body.check")) {
            const timeline =
              (await strapi.services.accounts.getTimeline(
                _.get(data, "employees[0].id"),
                data.date
              )) || [];

            if (timeline.length === 0) {
              return ctx.badRequest(
                "Unable to find timeline for specified employee"
              );
            }

            const isEmployeeTimeAvailable = await strapi.services.accounts.isTimeAvailable(
              timeline,
              from,
              to,
              data.id
            );

            if (!isEmployeeTimeAvailable && !data.check) {
              return ctx.badRequest("Selected time is not available");
            }
          }
        }
        /**
         * If item was already checked (done) than do not update time or date, since it will not take any affect
         * because record was marked as done
         */
        if (data.check) {
          return strapi.services.waitinglist
            .edit({ _id: data.id }, data)
            .then(async (WaitingListRecord) => {
              strapi.services.eventemitter.emit(
                "waitingList.update",
                WaitingListRecord,
                data,
                ctx
              );
              return strapi.services.response.flash("Successfully updated");
            });
        }

        return strapi.services.waitinglist
          .edit({ _id: data.id }, data)
          .then(async (WaitingListRecord) => {
            strapi.services.eventemitter.emit(
              "waitingList.update",
              WaitingListRecord,
              data,
              ctx
            );
            return strapi.services.response.flash("Successfully updated");
          });
      })
      .catch((e) =>
        strapi.services.utils.errorHandler("waitingList.update", e, ctx)
      );
  },

  /**
   * Toggles property of waitingList object
   * @param ctx
   * @returns {Promise}
   */
  toggleProperty: async (ctx) => {
    return strapi.services.joi
      .validate({ ...ctx.params })
      .objectId("id", { optional: false, return: "objectId" })
      .isIn("property", ["flag", "check"], { optional: false })
      .result()
      .then(async (result) => {
        return strapi.services.waitinglist
          .fetch({ _id: ObjectId(result.id) })
          .then(async (record) => {
            if (record.id) {
              if (record.type !== WAITING_LIST_TYPE_WALKINS) {
                const isDoneClicked =
                  result.property === "check" && record["check"] === false;
                const timeline =
                  (await strapi.services.accounts.getTimeline(
                    _.get(record, "employees[0].id"),
                    moment(record.apptStartTime).unix(),
                    isDoneClicked
                  )) || [];

                if (
                  record.type !== WAITING_LIST_TYPE_WALKINS &&
                  timeline.length === 0
                ) {
                  return ctx.badRequest(
                    "Unable to find timeline for specified employee"
                  );
                }

                const from = _.get(record, "apptStartTime");
                const to = _.get(record, "apptEndTime");

                const isEmployeeTimeAvailable = await strapi.services.accounts.isTimeAvailable(
                  timeline,
                  moment(from).unix(),
                  moment(to).unix(),
                  record.id
                );

                if (
                  record.type !== WAITING_LIST_TYPE_WALKINS &&
                  !isEmployeeTimeAvailable &&
                  record.check === true &&
                  result.property === "check"
                ) {
                  return ctx.badRequest("Selected time is not available");
                }
              }
              const updatedRecord = await strapi.services.waitinglist.edit(
                { _id: record._id },
                {
                  ...record._doc,
                  ...{ [result.property]: !record[result.property] },
                }
              );
              if (updatedRecord) {
                strapi.io.sockets.emit("waitingList.setClients", true);
                return updatedRecord;
              } else throw new Error("Unable to toggle property");
            } else throw new Error("Record was not found");
          })
          .catch((e) => {
            return ctx.notFound();
          });
      })
      .catch((e) =>
        strapi.services.utils.errorHandler("waitingList.toggleProperty", e, ctx)
      );
  },
};
